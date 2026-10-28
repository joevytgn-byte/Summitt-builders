import { db } from "@/lib/db";
import { nextSeq, SEQ_START, docNo } from "@/lib/sequences";
import { notify } from "@/lib/notify";

type DealInput = {
  customerId: string;
  name: string;
  description?: string | null;
  contractValue: number;
  serviceId?: string | null;
  projectType?: string;
  address: string;
  estimateId?: string | null;
  managerId?: string | null;
  actorName: string;
};

/**
 * Creates a project plus an initial kickoff job when a deal is won.
 * Idempotent for estimates: an estimate can only convert once.
 */
export async function createProjectFromDeal(input: DealInput) {
  if (input.estimateId) {
    const existing = await db.project.findUnique({ where: { estimateId: input.estimateId } });
    if (existing) return { project: existing, created: false };
  }

  const [defaultManager, defaultDispatcher] = await Promise.all([
    db.employee.findFirst({ where: { position: { contains: "Project Manager" }, status: "ACTIVE" }, orderBy: { createdAt: "asc" } }),
    db.employee.findFirst({ where: { position: { contains: "Dispatcher" }, status: "ACTIVE" } }),
  ]);
  const managerId = input.managerId || defaultManager?.id || null;

  const result = await db.$transaction(async (tx) => {
    const projectNo = docNo("PRJ", await nextSeq(tx, "project", SEQ_START.project));
    const project = await tx.project.create({
      data: {
        projectNo,
        name: input.name,
        customerId: input.customerId,
        projectType: input.projectType ?? "Residential",
        serviceId: input.serviceId ?? null,
        serviceAddress: input.address,
        description: input.description ?? null,
        contractValue: input.contractValue,
        managerId,
        status: "PENDING",
        priority: "HIGH",
        progress: 0,
        estimateId: input.estimateId ?? null,
        notes: "Created automatically when the deal was marked won. Ready for scheduling.",
      },
    });
    const jobNo = docNo("JOB", await nextSeq(tx, "job", SEQ_START.job));
    const job = await tx.job.create({
      data: {
        jobNo,
        projectId: project.id,
        customerId: input.customerId,
        address: input.address,
        jobType: "Project kickoff & site mobilization",
        description: `Initial job for ${project.name}. Confirm scope, permits and crew availability, then schedule.`,
        durationMins: 120,
        managerId,
        dispatcherId: defaultDispatcher?.id ?? null,
        priority: "HIGH",
        status: "UNSCHEDULED",
      },
    });
    await tx.activity.create({
      data: {
        customerId: input.customerId,
        type: "PROJECT",
        title: `Project ${project.projectNo} created from won deal`,
        description: `${input.name} · ${input.contractValue.toLocaleString("en-US", { style: "currency", currency: "USD" })}`,
        actorName: input.actorName,
      },
    });
    return { project, job };
  });

  await notify({
    roles: ["ADMIN", "SALES_MANAGER"],
    employeeIds: [managerId, defaultDispatcher?.id].filter(Boolean) as string[],
    type: "PROJECT",
    title: `New project from won deal — ${result.project.name}`,
    body: `${result.project.projectNo} · ${input.actorName} marked the deal won. Kickoff job ${result.job.jobNo} is ready for scheduling.`,
    link: `/crm/projects/${result.project.id}`,
  });

  return { project: result.project, job: result.job, created: true };
}
