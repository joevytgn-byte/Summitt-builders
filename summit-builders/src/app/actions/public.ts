"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { appUrl, companyNotifyEmail, notify, sendEmail } from "@/lib/notify";
import { docNo, nextSeq, SEQ_START } from "@/lib/sequences";
import { dateVal, n, s, optional } from "@/lib/forms";

const MAX_FILE = 5 * 1024 * 1024;
const MAX_FILES = 4;

type QuoteResult =
  | { ok: true; requestNo: string; leadNo: string; message: string }
  | { ok: false; error: string };

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

function urgencyPriority(urgency: string) {
  if (urgency === "EMERGENCY") return "CRITICAL";
  if (urgency === "URGENT") return "HIGH";
  return "MEDIUM";
}

export async function submitQuote(formData: FormData): Promise<QuoteResult> {
  try {
    const name = s(formData, "name");
    const phone = s(formData, "phone");
    const email = s(formData, "email");
    const address = s(formData, "address");
    const city = s(formData, "city");
    const zip = s(formData, "zip");
    const description = s(formData, "description");
    const serviceId = optional(formData, "serviceId");
    const urgency = s(formData, "urgency", "NORMAL") || "NORMAL";
    const projectType = s(formData, "projectType", "Residential") || "Residential";
    const source = s(formData, "leadSource", "Website") || "Website";
    const preferredDate = dateVal(formData, "preferredDate");
    const company = optional(formData, "company");
    const estimatedSize = optional(formData, "estimatedSize");
    const notes = optional(formData, "notes");

    if (!name || !phone || !email || !address || !city || !zip || !description) {
      return { ok: false, error: "Please complete all required fields." };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
    if (normalizePhone(phone).length < 10) return { ok: false, error: "Enter a valid 10-digit phone number." };
    if (!serviceId) return { ok: false, error: "Choose the service you need." };

    const service = await db.service.findUnique({ where: { id: serviceId } });
    if (!service) return { ok: false, error: "That service is no longer available. Please choose another." };

    const files: Array<{ name: string; mime: string; size: number; data: string }> = [];
    const uploads = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (uploads.length > MAX_FILES) return { ok: false, error: `Please attach no more than ${MAX_FILES} files.` };
    for (const file of uploads) {
      if (file.size > MAX_FILE) return { ok: false, error: `${file.name} is larger than 5 MB.` };
      const buffer = Buffer.from(await file.arrayBuffer());
      files.push({ name: file.name, mime: file.type || "application/octet-stream", size: file.size, data: buffer.toString("base64") });
    }

    const phoneKey = normalizePhone(phone);
    const existingCustomers = await db.customer.findMany({ select: { id: true, phone: true, email: true } });
    let customer = existingCustomers.find((c) => (c.email && c.email.toLowerCase() === email.toLowerCase()) || normalizePhone(c.phone) === phoneKey);
    let customerId: string;
    let customerName = name;

    if (customer) {
      customerId = customer.id;
    } else {
      const created = await db.$transaction(async (tx) => {
        const customerNo = docNo("CUS", await nextSeq(tx, "customer", SEQ_START.customer));
        return tx.customer.create({
          data: {
            customerNo, name, company, phone, email,
            serviceAddress: address, city, state: s(formData, "state", "CO") || "CO", zip,
            leadSource: source, notes: "Created automatically from a website quote request.",
          },
        });
      });
      customerId = created.id;
      customerName = created.name;
    }

    // Round-robin to the active sales rep with the fewest open leads.
    const reps = await db.user.findMany({ where: { role: "SALES_REP", active: true, employeeId: { not: null } }, select: { employeeId: true } });
    let assignedToId: string | null = null;
    if (reps.length) {
      const counts = await Promise.all(reps.map(async (r) => ({
        id: r.employeeId!,
        count: await db.lead.count({ where: { assignedToId: r.employeeId!, status: { notIn: ["WON", "LOST"] } } }),
      })));
      counts.sort((a, b) => a.count - b.count);
      assignedToId = counts[0].id;
    }
    if (!assignedToId) {
      const manager = await db.employee.findFirst({ where: { position: { contains: "Sales Manager" }, status: "ACTIVE" } });
      assignedToId = manager?.id ?? null;
    }

    const result = await db.$transaction(async (tx) => {
      const requestNo = docNo("SR", await nextSeq(tx, "request", SEQ_START.request));
      const leadNo = docNo("LD", await nextSeq(tx, "lead", SEQ_START.lead));
      const lead = await tx.lead.create({
        data: {
          leadNo, customerId, title: `${service.name} — ${customerName}`,
          source, serviceId, projectType, estimatedValue: 0, assignedToId,
          priority: urgencyPriority(urgency), status: "NEW", description, notes,
          nextFollowUp: new Date(Date.now() + 4 * 3_600_000),
          createdById: null,
        },
      });
      const request = await tx.serviceRequest.create({
        data: {
          requestNo, customerId, leadId: lead.id, source, serviceId, projectType, description, urgency,
          status: "NEW", assignedToId, preferredDate, address, city, state: s(formData, "state", "CO") || "CO", zip,
          estimatedSize, notes,
          attachments: files.length ? { create: files } : undefined,
        },
      });
      await tx.activity.create({
        data: {
          customerId, leadId: lead.id, type: "REQUEST",
          title: `Website quote request ${requestNo} received — ${service.name}`,
          description: `${urgency.toLowerCase()} urgency · preferred ${preferredDate ? preferredDate.toLocaleDateString("en-US") : "flexible"}`,
          actorName: "Website",
        },
      });
      return { lead, request };
    });

    const assignedRep = assignedToId ? await db.employee.findUnique({ where: { id: assignedToId } }) : null;

    await notify({
      roles: ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER"],
      employeeIds: assignedToId ? [assignedToId] : [],
      type: "NEW_LEAD",
      title: `New website lead — ${company || name}`,
      body: `${result.request.requestNo} · ${service.name} · ${urgency.toLowerCase()} urgency${assignedRep ? ` · assigned to ${assignedRep.firstName} ${assignedRep.lastName}` : ""}`,
      link: `/crm/requests?q=${result.request.requestNo}`,
    });

    const base = await appUrl();
    const emailBody = `New quote request from the Summit Builders website

Customer: ${name}${company ? ` (${company})` : ""}
Phone: ${phone}
Email: ${email}
Service: ${service.name}
Project type: ${projectType}
Urgency: ${urgency}
Preferred appointment: ${preferredDate ? preferredDate.toLocaleString("en-US") : "Flexible"}
Estimated size: ${estimatedSize || "Not provided"}
Address: ${address}, ${city}, ${s(formData, "state", "CO") || "CO"} ${zip}

Project description:
${description}

Additional notes:
${notes || "None"}

Attachments: ${files.length ? files.map((f) => f.name).join(", ") : "None"}

Request: ${result.request.requestNo}
Lead: ${result.lead.leadNo}
Assigned to: ${assignedRep ? `${assignedRep.firstName} ${assignedRep.lastName}` : "Unassigned"}

Open in CRM: ${base}/crm/requests?q=${encodeURIComponent(result.request.requestNo)}
`;

    await sendEmail({
      to: await companyNotifyEmail(),
      subject: `New website lead — ${service.name} — ${name}`,
      body: emailBody,
      relatedType: "ServiceRequest",
      relatedId: result.request.id,
    });

    await sendEmail({
      to: email,
      subject: `We received your project request — Summit Builders`,
      body: `Hi ${name.split(" ")[0]},

Thank you for contacting Summit Builders. We have received your request for ${service.name.toLowerCase()} and a project consultant will contact you within one business day.

Your reference number is ${result.request.requestNo}.
${preferredDate ? `Preferred appointment: ${preferredDate.toLocaleString("en-US")}\n` : ""}
Project address: ${address}, ${city}, ${s(formData, "state", "CO") || "CO"} ${zip}

If your project is urgent, call us at (555) 123-4567.

— Summit Builders
Licensed, bonded & insured · Denver, CO`,
      relatedType: "ServiceRequest",
      relatedId: result.request.id,
    });

    revalidatePath("/crm/dashboard");
    revalidatePath("/crm/requests");
    revalidatePath("/crm/leads");
    revalidatePath("/crm/customers");
    revalidatePath("/crm/notifications");

    return {
      ok: true,
      requestNo: result.request.requestNo,
      leadNo: result.lead.leadNo,
      message: `Request ${result.request.requestNo} received.`,
    };
  } catch (e) {
    console.error("Quote submit failed", e);
    return { ok: false, error: "We could not submit your request. Please call (555) 123-4567 so we can help right away." };
  }
}
