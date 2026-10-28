import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const now = new Date();
const DAY = 86_400_000;

const at = (offsetDays: number, hour = 9, minute = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d;
};
const day = (offsetDays: number) => {
  const d = at(offsetDays);
  d.setHours(0, 0, 0, 0);
  return d;
};
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
const iso = (h: number, m = 0) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261027);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

async function main() {
  // wipe (dev seed only)
  await prisma.$transaction([
    prisma.attachment.deleteMany(),
    prisma.jobAssignment.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.activity.deleteMany(),
    prisma.followUp.deleteMany(),
    prisma.call.deleteMany(),
    prisma.estimateItem.deleteMany(),
    prisma.estimate.deleteMany(),
    prisma.job.deleteMany(),
    prisma.project.deleteMany(),
    prisma.serviceRequest.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.emailLog.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.department.deleteMany(),
    prisma.service.deleteMany(),
    prisma.portfolioProject.deleteMany(),
    prisma.testimonial.deleteMany(),
    prisma.serviceArea.deleteMany(),
    prisma.websiteContent.deleteMany(),
    prisma.counter.deleteMany(),
  ]);

  const pass = bcrypt.hashSync("demo1234", 10);

  /* ------------------------------- DEPARTMENTS ------------------------------ */
  const deptNames = [
    ["Leadership", "Company direction and client relationships"],
    ["Sales", "Estimating, sales and business development"],
    ["Operations", "Project management, dispatch and field operations"],
    ["Field Crew", "Skilled trades and site teams"],
    ["Office", "Administration, billing and customer care"],
  ];
  const depts: Record<string, string> = {};
  for (const [name, description] of deptNames) {
    const d = await prisma.department.create({ data: { name, description } });
    depts[name] = d.id;
  }

  /* -------------------------------- EMPLOYEES ------------------------------- */
  const employeeSeed = [
    ["EMP-101", "Marcus", "Bennett", "marcus@summitbuilders.com", "(303) 555-0101", "Owner / General Manager", "Leadership", 2012, 78, "Leadership, Estimating, Business Development", "#f97316"],
    ["EMP-102", "Dana", "Whitfield", "dana@summitbuilders.com", "(303) 555-0102", "Operations Manager", "Operations", 2015, 62, "Operations, Scheduling, Customer Care", "#0ea5e9"],
    ["EMP-103", "Alicia", "Torres", "alicia@summitbuilders.com", "(303) 555-0103", "Sales Manager", "Sales", 2017, 55, "Commercial Sales, Negotiation, Estimating", "#8b5cf6"],
    ["EMP-104", "Ryan", "Cole", "ryan@summitbuilders.com", "(303) 555-0104", "Senior Sales Representative", "Sales", 2019, 48, "Residential Sales, Roofing, Remodeling", "#10b981"],
    ["EMP-105", "Priya", "Shah", "priya@summitbuilders.com", "(303) 555-0105", "Sales Representative", "Sales", 2022, 42, "Residential Sales, Design Build, Follow-up", "#ec4899"],
    ["EMP-106", "Luis", "Ortega", "luis@summitbuilders.com", "(303) 555-0106", "Senior Project Manager", "Operations", 2014, 58, "Commercial Projects, Concrete, Roofing", "#f59e0b"],
    ["EMP-107", "Hannah", "Kim", "hannah@summitbuilders.com", "(303) 555-0107", "Project Manager", "Operations", 2020, 54, "Interior Remodeling, Scheduling, Quality Control", "#14b8a6"],
    ["EMP-108", "Derek", "Mason", "derek@summitbuilders.com", "(303) 555-0108", "Dispatcher", "Operations", 2021, 38, "Dispatch, Crew Planning, Logistics", "#3b82f6"],
    ["EMP-109", "James", "Walker", "james@summitbuilders.com", "(303) 555-0109", "Site Supervisor", "Field Crew", 2016, 44, "Framing, Carpentry, Site Supervision", "#ef4444"],
    ["EMP-110", "Miguel", "Santos", "miguel@summitbuilders.com", "(303) 555-0110", "Master Electrician", "Field Crew", 2018, 46, "Electrical, Lighting, Low Voltage", "#a855f7"],
    ["EMP-111", "Tyler", "Brooks", "tyler@summitbuilders.com", "(303) 555-0111", "HVAC Technician", "Field Crew", 2021, 41, "HVAC, Mechanical, Indoor Air Quality", "#06b6d4"],
    ["EMP-112", "Andre", "Lewis", "andre@summitbuilders.com", "(303) 555-0112", "Concrete Crew Lead", "Field Crew", 2017, 43, "Concrete, Flatwork, Foundations", "#84cc16"],
    ["EMP-113", "Nina", "Patel", "nina@summitbuilders.com", "(303) 555-0113", "Painter / Finish Lead", "Field Crew", 2022, 37, "Painting, Drywall Finish, Wallcoverings", "#f43f5e"],
    ["EMP-114", "Sofia", "Reyes", "sofia@summitbuilders.com", "(303) 555-0114", "Office Coordinator", "Office", 2023, 30, "Administration, Billing, Customer Care", "#64748b"],
  ] as const;

  const emp: Record<string, string> = {};
  for (const [employeeNo, firstName, lastName, email, phone, position, dept, year, rate, skills, color] of employeeSeed) {
    const e = await prisma.employee.create({
      data: {
        employeeNo,
        firstName,
        lastName,
        email,
        phone,
        position,
        departmentId: depts[dept],
        hireDate: new Date(year, (employeeNo.charCodeAt(6) % 12), 12),
        status: "ACTIVE",
        skills,
        hourlyRate: rate,
        avatarColor: color,
        address: "Denver, CO",
        emergencyContact: "On file",
      },
    });
    emp[employeeNo] = e.id;
  }
  const managerPairs: [string, string][] = [
    ["EMP-102", "EMP-101"], ["EMP-103", "EMP-101"], ["EMP-106", "EMP-101"],
    ["EMP-104", "EMP-103"], ["EMP-105", "EMP-103"], ["EMP-107", "EMP-106"],
    ["EMP-108", "EMP-102"], ["EMP-114", "EMP-102"], ["EMP-109", "EMP-106"],
    ["EMP-110", "EMP-106"], ["EMP-111", "EMP-106"], ["EMP-112", "EMP-106"], ["EMP-113", "EMP-106"],
  ];
  for (const [e, m] of managerPairs) {
    await prisma.employee.update({ where: { id: emp[e] }, data: { managerId: emp[m] } });
  }

  /* ---------------------------------- USERS --------------------------------- */
  const userSeed = [
    ["admin@summitbuilders.com", "Marcus Bennett", "SUPER_ADMIN", "EMP-101"],
    ["dana@summitbuilders.com", "Dana Whitfield", "ADMIN", "EMP-102"],
    ["alicia@summitbuilders.com", "Alicia Torres", "SALES_MANAGER", "EMP-103"],
    ["ryan@summitbuilders.com", "Ryan Cole", "SALES_REP", "EMP-104"],
    ["priya@summitbuilders.com", "Priya Shah", "SALES_REP", "EMP-105"],
    ["luis@summitbuilders.com", "Luis Ortega", "PROJECT_MANAGER", "EMP-106"],
    ["derek@summitbuilders.com", "Derek Mason", "DISPATCHER", "EMP-108"],
    ["james@summitbuilders.com", "James Walker", "FIELD", "EMP-109"],
  ] as const;
  const users: Record<string, string> = {};
  for (const [email, name, role, employeeNo] of userSeed) {
    const u = await prisma.user.create({
      data: { email, name, role, passwordHash: pass, employeeId: emp[employeeNo], active: true, phone: "303-555-0100" },
    });
    users[role] = u.id;
  }

  /* -------------------------------- SERVICES -------------------------------- */
  const serviceSeed = [
    ["General Construction", "general-construction", "Full-service building and site construction, managed end to end.", "Building2", true, 1],
    ["New Construction", "new-construction", "Custom homes and ground-up builds with transparent milestones.", "HardHat", true, 2],
    ["Commercial Construction", "commercial-construction", "Tenant buildouts, retail and office construction built around your schedule.", "Briefcase", true, 3],
    ["Renovation", "renovation", "Thoughtful updates that modernize how your space works and feels.", "RefreshCw", true, 4],
    ["Remodeling", "remodeling", "Kitchens, baths and whole-home remodels with premium finishes.", "Home", true, 5],
    ["Roofing", "roofing", "Repairs, replacements and storm restoration backed by a workmanship warranty.", "Warehouse", true, 6],
    ["Electrical", "electrical", "Licensed electrical service, panel upgrades and lighting design.", "Zap", true, 7],
    ["Plumbing", "plumbing", "Repairs, repipes and fixture installation by licensed plumbers.", "Droplets", false, 8],
    ["HVAC", "hvac", "Heating and cooling installs, service and indoor air quality.", "Wind", false, 9],
    ["Carpentry", "carpentry", "Custom framing, trim, cabinetry and finish carpentry.", "Hammer", false, 10],
    ["Concrete", "concrete", "Foundations, driveways, patios and decorative flatwork.", "Grid3x3", true, 11],
    ["Flooring", "flooring", "Hardwood, tile, LVP and carpet installed by detail-focused crews.", "LayoutGrid", false, 12],
    ["Painting", "painting", "Interior and exterior painting with crisp, lasting finishes.", "Paintbrush", true, 13],
    ["Drywall", "drywall", "Hanging, finishing and texture matched to your existing walls.", "Square", false, 14],
    ["Exterior & Interior", "exterior-interior", "Siding, decks, doors, trim and complete envelope improvements.", "PanelsTopLeft", false, 15],
    ["Maintenance", "maintenance", "Preventive maintenance plans for homes and commercial properties.", "Wrench", false, 16],
    ["Repairs", "repairs", "Fast, reliable fixes for the things that can't wait.", "Settings", false, 17],
    ["Custom Projects", "custom-projects", "Have something unique in mind? Our team will scope it with you.", "Sparkles", false, 18],
  ] as const;
  const svc: Record<string, string> = {};
  for (const [name, slug, shortDescription, icon, featured, sortOrder] of serviceSeed) {
    const s = await prisma.service.create({
      data: {
        name, slug, shortDescription, icon, featured, sortOrder, active: true,
        description: `${shortDescription} Our Summit Builders team handles permitting, scheduling, materials and quality control so you have one accountable partner from first walkthrough to final punch list.`,
        imageUrl: slug === "roofing" ? "/images/project-exterior.jpg" : slug === "remodeling" ? "/images/project-kitchen.jpg" : null,
      },
    });
    svc[slug] = s.id;
  }

  /* -------------------------------- CUSTOMERS ------------------------------- */
  const customerSeed = [
    ["CUS-1001", "Eleanor Hayes", null, "(303) 555-0142", "eleanor.hayes@example.com", "2847 Ashwood Lane", "Denver", "80209", "Website", "EMP-104"],
    ["CUS-1002", "Chris Nolan", "Northgate Properties LLC", "(720) 555-0188", "chris@northgateproperties.com", "1800 Blake Street, Suite 210", "Denver", "80202", "Referral", "EMP-103"],
    ["CUS-1003", "Sam Whitaker", null, "(303) 555-0133", "sam.whitaker@example.com", "4456 Zenobia Street", "Denver", "80212", "Website", "EMP-105"],
    ["CUS-1004", "Marla Cheney", "Boulder Creek Cafe", "(720) 555-0164", "marla@bouldercreekcafe.com", "1919 Pearl Street", "Boulder", "80302", "Referral", "EMP-104"],
    ["CUS-1005", "Greg Donnelly", null, "(303) 555-0175", "greg.donnelly@example.com", "7823 South Franklin Court", "Centennial", "80122", "Website", "EMP-105"],
    ["CUS-1006", "Frank Delgado", null, "(303) 555-0129", "frank.delgado@example.com", "3695 West 32nd Avenue", "Denver", "80211", "Phone", "EMP-104"],
    ["CUS-1007", "Dr. Amara Reyes", "Highline Dental Group", "(303) 555-0190", "office@highlinedental.com", "7400 East Orchard Road", "Greenwood Village", "80111", "Website", "EMP-103"],
    ["CUS-1008", "Maya Okafor", null, "(720) 555-0151", "maya.okafor@example.com", "1156 South Garfield Street", "Denver", "80210", "Website", "EMP-105"],
    ["CUS-1009", "Robert Feld", "Ridgeview HOA", "(303) 555-0117", "board@ridgeviewhoa.org", "9800 West Bowles Avenue", "Littleton", "80123", "Referral", "EMP-104"],
    ["CUS-1010", "Jenna Baker", null, "(303) 555-0168", "jenna.baker@example.com", "2045 South Clayton Street", "Denver", "80210", "Website", "EMP-105"],
    ["CUS-1011", "Pastor Dan Miles", "Summit Ridge Church", "(303) 555-0126", "office@summitridgechurch.org", "6500 West 20th Avenue", "Lakewood", "80214", "Referral", "EMP-103"],
    ["CUS-1012", "Olivia Chen", null, "(720) 555-0172", "olivia.chen@example.com", "3312 Tejon Street", "Denver", "80211", "Instagram", "EMP-104"],
    ["CUS-1013", "Ryan & Kate Thompson", null, "(303) 555-0149", "kate.thompson@example.com", "8375 Golden Way", "Golden", "80401", "Website", "EMP-105"],
    ["CUS-1014", "Nate Brooks", "Arbor Street Lofts", "(720) 555-0195", "nate@arborstreetlofts.com", "1450 Arbor Street", "Aurora", "80011", "Commercial", "EMP-103"],
  ] as const;
  const cust: Record<string, string> = {};
  for (const [customerNo, name, company, phone, email, serviceAddress, city, zip, leadSource, rep] of customerSeed) {
    const c = await prisma.customer.create({
      data: {
        customerNo, name, company, phone, email, serviceAddress, city, zip, leadSource,
        state: "CO", assignedRepId: emp[rep],
        billingAddress: company ? serviceAddress : null,
        createdAt: at(-120 + Number(customerNo.slice(-3)) % 100),
        notes: company ? "Commercial account — invoice to accounts payable." : null,
      },
    });
    cust[customerNo] = c.id;
  }

  /* ---------------------------------- LEADS --------------------------------- */
  type LeadSeed = [string, string, string, string, string, number, string, string, number, string, string, number | null, number | null, string | null, number | null];
  // no, customer, title, slug, projectType, value, rep, status, created, priority, source, nextFollowUp, won/lost day, lostReason, response
  const leadSeed: LeadSeed[] = [
    ["LD-1001", "CUS-1001", "Hayes kitchen remodel", "remodeling", "Residential", 42000, "EMP-104", "QUALIFIED", -6, "HIGH", "Website", 1, null, null, 18],
    ["LD-1002", "CUS-1002", "Northgate suite 210 office buildout", "commercial-construction", "Commercial", 185000, "EMP-103", "NEGOTIATION", -32, "HIGH", "Referral", -2, null, null, 12],
    ["LD-1003", "CUS-1003", "Whitaker primary bath renovation", "renovation", "Residential", 28500, "EMP-105", "ESTIMATE", -14, "HIGH", "Website", 2, null, null, 21],
    ["LD-1004", "CUS-1004", "Boulder Creek Cafe patio build", "concrete", "Commercial", 32000, "EMP-104", "SITE_VISIT", -8, "MEDIUM", "Referral", 1, null, null, 35],
    ["LD-1005", "CUS-1005", "Donnelly roof replacement", "roofing", "Residential", 24500, "EMP-105", "WON", -25, "HIGH", "Website", null, -4, null, 9],
    ["LD-1006", "CUS-1006", "Delgado 200A panel upgrade", "electrical", "Residential", 6800, "EMP-104", "WON", -48, "MEDIUM", "Phone", null, -20, null, 22],
    ["LD-1007", "CUS-1007", "Highline Dental front office renovation", "commercial-construction", "Commercial", 96000, "EMP-103", "ESTIMATE", -21, "HIGH", "Website", -1, null, null, 14],
    ["LD-1008", "CUS-1008", "Okafor kitchen and flooring", "remodeling", "Residential", 57000, "EMP-105", "NEGOTIATION", -18, "HIGH", "Website", 3, null, null, 27],
    ["LD-1009", "CUS-1009", "Ridgeview HOA roofing phase 2", "roofing", "Commercial", 78000, "EMP-104", "QUALIFIED", -11, "MEDIUM", "Referral", 2, null, null, 44],
    ["LD-1010", "CUS-1010", "Baker basement finish", "renovation", "Residential", 38000, "EMP-105", "CONTACTED", -3, "MEDIUM", "Website", 0, null, null, 16],
    ["LD-1011", "CUS-1011", "Summit Ridge Church HVAC replacement", "hvac", "Commercial", 41000, "EMP-103", "SITE_VISIT", -5, "MEDIUM", "Referral", 2, null, null, 31],
    ["LD-1012", "CUS-1012", "Chen interior repaint", "painting", "Residential", 7200, "EMP-104", "NEW", -1, "LOW", "Instagram", null, null, null, null],
    ["LD-1013", "CUS-1013", "Thompson custom home build", "new-construction", "Residential", 420000, "EMP-105", "QUALIFIED", -9, "HIGH", "Website", 4, null, null, 25],
    ["LD-1014", "CUS-1014", "Arbor Lofts corridor refresh", "commercial-construction", "Commercial", 64000, "EMP-103", "CONTACTED", -4, "MEDIUM", "Commercial", 1, null, null, 38],
    ["LD-1015", "CUS-1001", "Hayes primary bath renovation", "renovation", "Residential", 26500, "EMP-104", "WON", -60, "MEDIUM", "Website", null, -38, null, 11],
    ["LD-1016", "CUS-1002", "Northgate lobby refresh", "commercial-construction", "Commercial", 28000, "EMP-103", "LOST", -45, "LOW", "Referral", null, -30, "Chose a lower bid", 29],
    ["LD-1017", "CUS-1006", "Delgado garage repair", "repairs", "Residential", 4500, "EMP-104", "LOST", -28, "LOW", "Phone", null, -22, "Project postponed indefinitely", 41],
    ["LD-1018", "CUS-1008", "Okafor fence and exterior trim", "exterior-interior", "Residential", 12500, "EMP-105", "NEW", 0, "MEDIUM", "Website", null, null, null, null],
  ];

  const lead: Record<string, string> = {};
  for (const [leadNo, customerNo, title, slug, projectType, value, rep, status, created, priority, source, nextFollowUp, closedDay, lostReason, response] of leadSeed) {
    const l = await prisma.lead.create({
      data: {
        leadNo, customerId: cust[customerNo], title, serviceId: svc[slug], projectType,
        estimatedValue: value, assignedToId: emp[rep], status, priority, source,
        description: `${title} for ${customerNo === "CUS-1002" || customerNo === "CUS-1007" || customerNo === "CUS-1009" || customerNo === "CUS-1011" || customerNo === "CUS-1014" ? "the commercial property" : "the homeowner"} at ${customerSeed.find((c) => c[0] === customerNo)![5]}. Scope reviewed on site; customer is looking for a detailed proposal and a clear schedule.`,
        nextFollowUp: nextFollowUp === null ? null : at(nextFollowUp, 10, 0),
        lastContactAt: response === null ? null : at(created + 1, 14, 30),
        responseMins: response,
        wonAt: status === "WON" ? at(closedDay ?? created, 16, 0) : null,
        lostAt: status === "LOST" ? at(closedDay ?? created, 16, 0) : null,
        lostReason,
        createdById: users[status === "NEW" && source === "Website" ? "SUPER_ADMIN" : "SALES_MANAGER"],
        createdAt: at(created, 9, 15),
        updatedAt: at(Math.max(created + 1, -1), 15, 0),
        notes: status === "NEGOTIATION" ? "Verbal approval expected after revised scope review." : null,
      },
    });
    lead[leadNo] = l.id;
  }

  /* ----------------------------- SERVICE REQUESTS --------------------------- */
  const requestSeed = [
    ["SR-2001", "CUS-1001", "LD-1001", "Website", "renovation", "Full primary bath remodel including tile, vanity, shower and lighting. Looking to start within the next month.", "NORMAL", "NEW", "EMP-105", -1, 1],
    ["SR-2002", "CUS-1002", "LD-1002", "Referral", "commercial-construction", "Suite 210 buildout — 2,400 sq ft of offices, break room and reception. Need a construction partner familiar with building permits.", "URGENT", "CONTACTED", "EMP-103", -5, 2],
    ["SR-2003", "CUS-1003", "LD-1003", "Website", "renovation", "Bathroom renovation. Existing tub/shower combo to be replaced with a walk-in shower. New vanity and heated floor.", "NORMAL", "QUALIFIED", "EMP-105", -9, 7],
    ["SR-2004", "CUS-1006", "LD-1006", "Phone", "electrical", "Electrical panel is outdated and tripping. Need an inspection and likely a 200 amp upgrade.", "URGENT", "COMPLETED", "EMP-104", -48, -44],
    ["SR-2005", "CUS-1005", "LD-1005", "Website", "roofing", "Hail damage to the north-facing roof. Insurance adjuster has already been out. Need replacement and gutters.", "URGENT", "IN_PROGRESS", "EMP-105", -20, -4],
    ["SR-2006", "CUS-1010", "LD-1010", "Email", "renovation", "Basement is unfinished. Would like a family room, guest bedroom and full bath. Need help with design and permits.", "NORMAL", "NEW", "EMP-105", -3, 0],
    ["SR-2007", "CUS-1012", null, "Website", "painting", "Repaint main floor: living room, dining room, kitchen and hallway. Ceilings included. Prefer warm white.", "NORMAL", "NEW", null, 0, 0],
    ["SR-2008", "CUS-1008", "LD-1018", "Website", "exterior-interior", "Replace back fence and repair exterior trim around the mudroom. About 90 linear feet.", "NORMAL", "NEW", "EMP-105", 0, 18],
    ["SR-2009", "CUS-1007", "LD-1007", "Referral", "commercial-construction", "Dental office reception and front office refresh. Must work around clinic hours; after-hours work preferred.", "URGENT", "ESTIMATE_PENDING", "EMP-103", -12, 4],
    ["SR-2010", "CUS-1013", "LD-1013", "Referral", "new-construction", "Custom home on a lot in Golden. Approximately 3,800 sq ft plus garage. Architect drawings are available.", "NORMAL", "SITE_VISIT_SCHEDULED", "EMP-105", -2, 9],
    ["SR-2011", "CUS-1009", "LD-1009", "Phone", "roofing", "Phase 2 roofing for four HOA buildings. Phase 1 was completed by Summit last year.", "NORMAL", "CONTACTED", "EMP-104", -7, 5],
    ["SR-2012", "CUS-1014", "LD-1014", "Manual", "commercial-construction", "Hallway and common area refresh across two floors. New paint, lighting and flooring transitions.", "NORMAL", "SCHEDULED", "EMP-103", -3, 6],
  ] as [string, string, string | null, string, string, string, string, string, string | null, number, number | null][];
  const req: Record<string, string> = {};
  for (const [requestNo, customerNo, leadNo, source, slug, description, urgency, status, assigned, created, preferred] of requestSeed) {
    const r = await prisma.serviceRequest.create({
      data: {
        requestNo, customerId: cust[customerNo], leadId: leadNo ? lead[leadNo] : null, source,
        serviceId: svc[slug], projectType: customerNo === "CUS-1002" || customerNo === "CUS-1004" || customerNo === "CUS-1007" || customerNo === "CUS-1009" || customerNo === "CUS-1011" || customerNo === "CUS-1014" ? "Commercial" : "Residential",
        description, urgency, status, assignedToId: assigned ? emp[assigned] : null,
        address: customerSeed.find((c) => c[0] === customerNo)![5], city: customerSeed.find((c) => c[0] === customerNo)![6], zip: customerSeed.find((c) => c[0] === customerNo)![7],
        preferredDate: preferred === 0 ? at(2, 10, 0) : at(preferred ?? 2, 9, 0),
        estimatedSize: slug === "commercial-construction" ? "2,400 sq ft" : "1,100 sq ft",
        createdAt: at(created, 8, 42), updatedAt: minutesAgo(90),
        notes: status === "NEW" ? "Auto-created from inbound inquiry. Needs first contact." : null,
      },
    });
    req[requestNo] = r.id;
  }
  await prisma.attachment.create({
    data: { requestId: req["SR-2003"], name: "existing-bathroom.jpg", mime: "image/jpeg", size: 184320, data: "demo" },
  });

  /* -------------------------------- ESTIMATES ------------------------------- */
  type ItemSeed = [string, string, number, string, number];
  const estimates: {
    no: string; customer: string; lead: string | null; title: string; status: string; days: number; valid: number;
    discount: number; taxRate: number; items: ItemSeed[]; sent?: number; decided?: number;
  }[] = [
    {
      no: "EST-3001", customer: "CUS-1005", lead: "LD-1005", title: "Roof replacement & gutter package", status: "ACCEPTED", days: -18, valid: 30, discount: 500, taxRate: 0,
      items: [
        ["Tear-off existing shingles and haul away", "LABOR", 32, "sq", 145],
        ["Architectural shingles — charcoal", "MATERIAL", 32, "sq", 165],
        ["Synthetic underlayment", "MATERIAL", 32, "sq", 38],
        ["Seamless gutters & downspouts", "MATERIAL", 140, "lf", 16],
        ["Roofing crew labor & disposal", "LABOR", 3, "day", 1800],
      ], sent: -16, decided: -14,
    },
    {
      no: "EST-3002", customer: "CUS-1006", lead: "LD-1006", title: "200A electrical panel upgrade", status: "ACCEPTED", days: -40, valid: 30, discount: 0, taxRate: 0,
      items: [
        ["200A panel & breakers", "MATERIAL", 1, "ea", 1850],
        ["Meter base replacement", "MATERIAL", 1, "ea", 620],
        ["Licensed electrician labor", "LABOR", 16, "hr", 115],
        ["Permit & inspection coordination", "LABOR", 1, "ea", 350],
      ], sent: -38, decided: -30,
    },
    {
      no: "EST-3003", customer: "CUS-1001", lead: "LD-1015", title: "Primary bath renovation", status: "ACCEPTED", days: -50, valid: 45, discount: 750, taxRate: 0,
      items: [
        ["Demolition & dumpster", "LABOR", 1, "ea", 1450],
        ["Custom vanity & quartz top", "MATERIAL", 1, "ea", 4850],
        ["Porcelain tile & installation", "MATERIAL", 180, "sq ft", 32],
        ["Walk-in shower framing & waterproofing", "LABOR", 1, "ea", 5200],
        ["Plumbing rough-in & fixtures", "LABOR", 1, "ea", 6400],
        ["Electrical & lighting", "LABOR", 1, "ea", 2800],
        ["Painting & finish carpentry", "LABOR", 1, "ea", 2100],
      ], sent: -48, decided: -38,
    },
    {
      no: "EST-3004", customer: "CUS-1002", lead: "LD-1002", title: "Suite 210 commercial buildout", status: "SENT", days: -12, valid: 30, discount: 2500, taxRate: 0,
      items: [
        ["Demolition & site protection", "LABOR", 1, "ea", 6800],
        ["Metal stud framing & drywall", "MATERIAL", 2400, "sq ft", 18],
        ["Suspended ceiling grid & tile", "MATERIAL", 2400, "sq ft", 7.5],
        ["Electrical distribution & lighting", "LABOR", 1, "ea", 32500],
        ["HVAC modifications", "LABOR", 1, "ea", 28700],
        ["LVP flooring", "MATERIAL", 2400, "sq ft", 6.25],
        ["Millwork & reception desk", "MATERIAL", 1, "ea", 16400],
        ["Commercial GC supervision", "LABOR", 8, "wk", 5400],
        ["Permits & plan review", "LABOR", 1, "ea", 4900],
      ], sent: -10,
    },
    {
      no: "EST-3005", customer: "CUS-1007", lead: "LD-1007", title: "Dental office reception renovation", status: "SENT", days: -9, valid: 30, discount: 1200, taxRate: 0,
      items: [
        ["After-hours demolition", "LABOR", 1, "ea", 3900],
        ["Framing & drywall modifications", "LABOR", 1, "ea", 7800],
        ["Millwork & reception desk", "MATERIAL", 1, "ea", 14200],
        ["LVP & tile flooring", "MATERIAL", 980, "sq ft", 9.5],
        ["Electrical & lighting upgrades", "LABOR", 1, "ea", 11400],
        ["Exam room ceiling tile", "MATERIAL", 980, "sq ft", 8.2],
        ["Paint & finishes", "LABOR", 1, "ea", 5600],
        ["Project management", "LABOR", 1, "ea", 7200],
        ["Permits", "LABOR", 1, "ea", 2100],
      ], sent: -7,
    },
    {
      no: "EST-3006", customer: "CUS-1003", lead: "LD-1003", title: "Primary bath walk-in shower", status: "VIEWED", days: -6, valid: 30, discount: 500, taxRate: 0,
      items: [
        ["Demo existing tub & surround", "LABOR", 1, "ea", 1200],
        ["Walk-in shower framing & waterproofing", "LABOR", 1, "ea", 4600],
        ["Tile & installation", "MATERIAL", 120, "sq ft", 34],
        ["Glass shower enclosure", "MATERIAL", 1, "ea", 2850],
        ["Vanity, top & fixtures", "MATERIAL", 1, "ea", 4100],
        ["Plumbing & electrical", "LABOR", 1, "ea", 4900],
        ["Heated floor", "MATERIAL", 45, "sq ft", 22],
        ["Paint & trim", "LABOR", 1, "ea", 1300],
      ], sent: -4,
    },
    {
      no: "EST-3007", customer: "CUS-1008", lead: "LD-1008", title: "Kitchen remodel & flooring", status: "DRAFT", days: -2, valid: 30, discount: 0, taxRate: 0,
      items: [
        ["Kitchen demo & dumpster", "LABOR", 1, "ea", 2200],
        ["Custom cabinetry", "MATERIAL", 1, "ea", 14800],
        ["Quartz countertops", "MATERIAL", 54, "sq ft", 88],
        ["Appliance package", "MATERIAL", 1, "ea", 9200],
        ["Electrical & lighting", "LABOR", 1, "ea", 4300],
        ["Plumbing & sink", "LABOR", 1, "ea", 3100],
        ["Engineered hardwood flooring", "MATERIAL", 850, "sq ft", 11.5],
        ["Installation & finish carpentry", "LABOR", 1, "ea", 6200],
      ],
    },
    {
      no: "EST-3008", customer: "CUS-1009", lead: "LD-1009", title: "Ridgeview HOA roofing — phase 2", status: "SENT", days: -5, valid: 45, discount: 3000, taxRate: 0,
      items: [
        ["Tear-off & disposal (4 buildings)", "LABOR", 1, "ea", 12800],
        ["Architectural shingles", "MATERIAL", 96, "sq", 168],
        ["Underlayment & ice shield", "MATERIAL", 96, "sq", 42],
        ["Gutters & downspouts", "MATERIAL", 520, "lf", 15],
        ["Crew labor", "LABOR", 12, "day", 1750],
        ["HOA coordination & staging", "LABOR", 1, "ea", 2400],
      ], sent: -3,
    },
    {
      no: "EST-3009", customer: "CUS-1013", lead: "LD-1013", title: "Thompson custom home — pre-construction", status: "DRAFT", days: -1, valid: 60, discount: 0, taxRate: 0,
      items: [
        ["Pre-construction & estimating", "LABOR", 1, "ea", 12500],
        ["Architectural coordination", "LABOR", 1, "ea", 8400],
        ["Site work allowance", "MATERIAL", 1, "ea", 48000],
        ["Foundation & concrete", "MATERIAL", 1, "ea", 62000],
        ["Framing package", "MATERIAL", 1, "ea", 85000],
        ["MEP rough-in", "LABOR", 1, "ea", 74000],
        ["Finishes allowance", "MATERIAL", 1, "ea", 95000],
        ["GC overhead & supervision", "LABOR", 1, "ea", 38000],
      ],
    },
    {
      no: "EST-3010", customer: "CUS-1014", lead: "LD-1014", title: "Arbor Lofts corridor refresh", status: "REJECTED", days: -24, valid: 30, discount: 0, taxRate: 0,
      items: [
        ["Demo & protection", "LABOR", 1, "ea", 3800],
        ["Luxury vinyl plank", "MATERIAL", 1800, "sq ft", 7.8],
        ["Paint & wallcovering", "LABOR", 1, "ea", 12600],
        ["Corridor lighting", "LABOR", 1, "ea", 9800],
        ["Door hardware & signage", "MATERIAL", 1, "ea", 4600],
        ["After-hours supervision", "LABOR", 1, "ea", 6400],
      ], sent: -22, decided: -15,
    },
  ];

  const est: Record<string, string> = {};
  for (const e of estimates) {
    let subtotal = 0;
    const items = e.items.map(([description, category, quantity, unit, unitPrice], i) => {
      const amount = Math.round(quantity * unitPrice * 100) / 100;
      subtotal += amount;
      return { description, category, quantity, unit, unitPrice, amount, sortOrder: i };
    });
    subtotal = Math.round(subtotal * 100) / 100;
    const taxable = Math.round((subtotal - e.discount) * 100) / 100;
    const taxAmount = Math.round(taxable * e.taxRate) / 100;
    const total = Math.round((taxable + taxAmount) * 100) / 100;
    const created = await prisma.estimate.create({
      data: {
        estimateNo: e.no, customerId: cust[e.customer], leadId: e.lead ? lead[e.lead] : null, title: e.title,
        status: e.status, validUntil: at(e.days + e.valid, 17, 0), subtotal, discount: e.discount,
        taxRate: e.taxRate, taxAmount, total,
        notes: "Estimate includes standard site protection and daily cleanup. Pricing valid for 30 days unless noted.",
        createdById: users.SALES_MANAGER, approvedById: e.status === "ACCEPTED" ? users.SUPER_ADMIN : null,
        sentAt: e.sent ? at(e.sent, 11, 0) : null, decidedAt: e.decided ? at(e.decided, 15, 0) : null,
        createdAt: at(e.days, 10, 0),
        items: { create: items },
      },
    });
    est[e.no] = created.id;
  }

  /* -------------------------------- PROJECTS -------------------------------- */
  const projectSeed = [
    ["PRJ-4001", "Donnelly Roof Replacement", "CUS-1005", "roofing", "Residential", 24500, -4, 3, null, "EMP-106", "ACTIVE", "HIGH", 65, "EST-3001", "Tear-off and architectural shingle install. HOA approved charcoal shingle."],
    ["PRJ-4002", "Delgado Electrical Panel Upgrade", "CUS-1006", "electrical", "Residential", 6800, -20, -14, -14, "EMP-106", "COMPLETED", "MEDIUM", 100, "EST-3002", "Permit finaled. Customer received inspection paperwork."],
    ["PRJ-4003", "Hayes Primary Bath Renovation", "CUS-1001", "renovation", "Residential", 26500, -10, 12, null, "EMP-107", "ACTIVE", "HIGH", 45, "EST-3003", "Tile and waterproofing underway. Vanity delivery scheduled."],
    ["PRJ-4004", "Highline Dental Reception Renovation", "CUS-1007", "commercial-construction", "Commercial", 96000, -7, 25, null, "EMP-107", "ACTIVE", "HIGH", 30, null, "After-hours work. Clinic remains open during construction."],
    ["PRJ-4005", "Ridgeview HOA Roofing Phase 1", "CUS-1009", "roofing", "Commercial", 78000, -70, -50, -48, "EMP-106", "COMPLETED", "MEDIUM", 100, null, "Four buildings completed. Final walkthrough signed by HOA board."],
    ["PRJ-4006", "Okafor Kitchen & Flooring", "CUS-1008", "remodeling", "Residential", 57000, -25, -3, null, "EMP-107", "DELAYED", "HIGH", 35, null, "Cabinetry shipment delayed by supplier. New install date being coordinated."],
    ["PRJ-4007", "Boulder Creek Cafe Patio", "CUS-1004", "concrete", "Commercial", 32000, 5, 18, null, "EMP-106", "SCHEDULED", "MEDIUM", 0, null, "Permit issued. Saw cutting and formwork scheduled."],
    ["PRJ-4008", "Chen Interior Repaint", "CUS-1012", "painting", "Residential", 7200, null, 9, null, "EMP-107", "PENDING", "LOW", 10, null, "Waiting on homeowner color selections."],
    ["PRJ-4009", "Summit Ridge Church Commons", "CUS-1011", "general-construction", "Commercial", 41000, null, 40, null, "EMP-106", "ON_HOLD", "MEDIUM", 15, null, "On hold pending board budget approval."],
  ] as const;
  const proj: Record<string, string> = {};
  for (const [projectNo, name, customerNo, slug, projectType, value, start, end, actual, manager, status, priority, progress, estimateNo, notes] of projectSeed) {
    const p = await prisma.project.create({
      data: {
        projectNo, name, customerId: cust[customerNo], projectType, serviceId: svc[slug],
        serviceAddress: customerSeed.find((c) => c[0] === customerNo)![5],
        description: `${name} — managed by ${manager === "EMP-106" ? "Luis Ortega" : "Hannah Kim"}. ${notes}`,
        contractValue: value, startDate: start === null ? null : day(start), expectedEnd: end === null ? null : day(end),
        actualEnd: actual === null ? null : day(actual), managerId: emp[manager], status, priority, progress,
        estimateId: estimateNo ? est[estimateNo] : null,
        notes, createdAt: day(start ?? -30),
      },
    });
    proj[projectNo] = p.id;
  }

  /* ---------------------------------- JOBS ---------------------------------- */
  type JobSeed = [
    string, string | null, string, string, number | null, string | null, number, string, string, string[],
    string | null, string, number, string | null, string | null
  ];
  // no, project, customer, type, dateOffset, startTime, duration, status, priority, crew, dispatcher, manager, hoursAgoCreated, notes, completionNotes
  const jobSeed: JobSeed[] = [
    ["JOB-5001", "PRJ-4001", "CUS-1005", "Roof tear-off & deck inspection", 0, "07:00", 480, "DISPATCHED", "HIGH", ["EMP-109", "EMP-112"], "EMP-108", "EMP-106", 20, "Dumpster delivered at 6:30am. HOA parking permit on file.", null],
    ["JOB-5002", "PRJ-4001", "CUS-1005", "Shingle installation", 1, "07:00", 480, "SCHEDULED", "HIGH", ["EMP-109", "EMP-112"], "EMP-108", "EMP-106", 19, "Weather dependent.", null],
    ["JOB-5003", "PRJ-4001", "CUS-1005", "Gutter installation & cleanup", 3, "08:00", 240, "SCHEDULED", "MEDIUM", ["EMP-109"], "EMP-108", "EMP-106", 18, null, null],
    ["JOB-5004", "PRJ-4003", "CUS-1001", "Bathroom demo & rough-in", 0, "08:00", 480, "IN_PROGRESS", "HIGH", ["EMP-110", "EMP-113"], "EMP-108", "EMP-107", 22, "Water shutoff confirmed with homeowner.", null],
    ["JOB-5005", "PRJ-4003", "CUS-1001", "Tile & waterproofing", 2, "08:00", 480, "SCHEDULED", "HIGH", ["EMP-109", "EMP-113"], "EMP-108", "EMP-107", 21, null, null],
    ["JOB-5006", "PRJ-4003", "CUS-1001", "Vanity & fixture install", 8, "08:00", 360, "SCHEDULED", "MEDIUM", ["EMP-110"], "EMP-108", "EMP-107", 5, null, null],
    ["JOB-5007", "PRJ-4003", "CUS-1001", "Punch list & final walkthrough", 12, "09:00", 180, "SCHEDULED", "LOW", ["EMP-107"], "EMP-108", "EMP-107", 5, null, null],
    ["JOB-5008", "PRJ-4004", "CUS-1007", "Selective demolition", 0, "07:30", 420, "EN_ROUTE", "HIGH", ["EMP-112", "EMP-113"], "EMP-108", "EMP-107", 26, "After-hours access code provided by office manager.", null],
    ["JOB-5009", "PRJ-4004", "CUS-1007", "Framing & drywall", 2, "18:00", 360, "SCHEDULED", "HIGH", ["EMP-109", "EMP-113"], "EMP-108", "EMP-107", 24, "Evening shift to avoid clinic disruption.", null],
    ["JOB-5010", "PRJ-4004", "CUS-1007", "Electrical rough-in", 5, "18:00", 360, "SCHEDULED", "HIGH", ["EMP-110"], "EMP-108", "EMP-107", 12, null, null],
    ["JOB-5011", "PRJ-4006", "CUS-1008", "Cabinet installation", 0, "09:00", 300, "SCHEDULED", "MEDIUM", ["EMP-109"], "EMP-108", "EMP-107", 14, "Confirm cabinet delivery before crew dispatch.", null],
    ["JOB-5012", "PRJ-4006", "CUS-1008", "Flooring installation", 3, "08:00", 480, "RESCHEDULED", "HIGH", ["EMP-112"], "EMP-108", "EMP-107", 9, "Original date missed due to cabinet delay.", null],
    ["JOB-5013", "PRJ-4002", "CUS-1006", "Final inspection & closeout", -14, "08:00", 120, "COMPLETED", "MEDIUM", ["EMP-110"], "EMP-108", "EMP-106", 40, null, "Inspection passed. Panel labeled and customer walkthrough complete."],
    ["JOB-5014", "PRJ-4005", "CUS-1009", "Final roof walkthrough", -48, "10:00", 120, "COMPLETED", "MEDIUM", ["EMP-106", "EMP-109"], "EMP-108", "EMP-106", 60, null, "HOA signed off. All gutters cleared."],
    ["JOB-5015", "PRJ-4007", "CUS-1004", "Layout & saw cutting", 5, "07:00", 360, "SCHEDULED", "MEDIUM", ["EMP-112"], "EMP-108", "EMP-106", 4, "Call 811 locate scheduled 48 hours prior.", null],
    ["JOB-5016", "PRJ-4007", "CUS-1004", "Formwork & rebar", 7, "07:00", 480, "UNSCHEDULED", "MEDIUM", [], null, "EMP-106", 3, "Crew not yet assigned.", null],
    ["JOB-5017", "PRJ-4008", "CUS-1012", "Color consultation & prep", 2, "10:00", 120, "UNSCHEDULED", "LOW", [], null, "EMP-107", 2, "Waiting on color choices.", null],
    ["JOB-5018", "PRJ-4009", "CUS-1011", "HVAC assessment", 4, "13:00", 180, "SCHEDULED", "MEDIUM", ["EMP-111"], "EMP-108", "EMP-106", 2, null, null],
    ["JOB-5019", null, "CUS-1006", "Site visit — garage repair", 1, "15:30", 90, "SCHEDULED", "LOW", ["EMP-106"], "EMP-108", "EMP-106", 2, "Estimate follow-up visit.", null],
    ["JOB-5020", null, "CUS-1010", "Basement assessment", 0, "16:00", 60, "SCHEDULED", "MEDIUM", ["EMP-107"], "EMP-108", "EMP-107", 1, "Measure for design-build estimate.", null],
    ["JOB-5021", "PRJ-4006", "CUS-1008", "Backsplash & trim", 6, "08:00", 300, "SCHEDULED", "MEDIUM", ["EMP-113"], "EMP-108", "EMP-107", 6, null, null],
    ["JOB-5022", null, "CUS-1003", "Emergency plumbing repair", -1, "17:00", 120, "COMPLETED", "HIGH", ["EMP-110"], "EMP-108", "EMP-106", 30, null, "Supply line repaired, area dried and verified."],
  ];

  const job: Record<string, string> = {};
  for (const [jobNo, projectNo, customerNo, jobType, dateOffset, startTime, duration, status, priority, crew, dispatcher, manager, createdAtHrs, notes, completionNotes] of jobSeed) {
    const j = await prisma.job.create({
      data: {
        jobNo, projectId: projectNo ? proj[projectNo] : null, customerId: cust[customerNo],
        address: customerSeed.find((c) => c[0] === customerNo)![5],
        jobType, description: `${jobType} at ${customerNo} — coordinated by Summit Builders operations.`,
        scheduledDate: dateOffset === null ? null : day(dateOffset), startTime: dateOffset === null ? null : startTime,
        durationMins: duration, status, priority,
        managerId: manager ? emp[manager] : null, dispatcherId: dispatcher ? emp[dispatcher] : null,
        notes, completionNotes, completedAt: status === "COMPLETED" ? day(dateOffset ?? 0) : null,
        createdAt: new Date(Date.now() - createdAtHrs * 3_600_000),
      },
    });
    job[jobNo] = j.id;
    for (const c of crew) {
      await prisma.jobAssignment.create({ data: { jobId: j.id, employeeId: emp[c], role: c === "EMP-106" || c === "EMP-107" ? "LEAD" : "CREW" } });
    }
  }

  /* ---------------------------------- CALLS --------------------------------- */
  const callOutcomes = ["CONNECTED", "CONNECTED", "CONNECTED", "VOICEMAIL", "NO_ANSWER", "CONNECTED", "CALLBACK"];
  const salesReps = ["EMP-103", "EMP-104", "EMP-105"];
  const customerIds = Object.values(cust);
  let callCounter = 0;
  for (const rep of salesReps) {
    const repsLeads = leadSeed.filter((l) => l[6] === rep);
    for (let i = 0; i < 16; i++) {
      callCounter++;
      const daysAgo = Math.floor(rnd() * 55);
      const startHour = 8 + Math.floor(rnd() * 9);
      const startMin = Math.floor(rnd() * 4) * 15;
      const startedAt = at(-daysAgo, startHour, startMin);
      const outcome = pick(callOutcomes);
      const connected = outcome === "CONNECTED" || outcome === "CALLBACK";
      const durationSec = connected ? 180 + Math.floor(rnd() * 1500) : 20 + Math.floor(rnd() * 50);
      const leadRow = repsLeads[Math.floor(rnd() * repsLeads.length)];
      const customerNo = leadRow ? leadRow[1] : pick(["CUS-1001", "CUS-1002", "CUS-1006", "CUS-1010"]);
      const followUp = rnd() > 0.72;
      await prisma.call.create({
        data: {
          employeeId: emp[rep], customerId: cust[customerNo], leadId: leadRow ? lead[leadRow[0]] : null,
          startedAt, endedAt: new Date(startedAt.getTime() + durationSec * 1000), durationSec,
          direction: rnd() > 0.35 ? "OUTGOING" : "INCOMING", callType: rnd() > 0.3 ? "Sales" : "Follow-up",
          outcome, connected, notes: connected ? pick(["Discussed scope and timeline.", "Confirmed site visit details.", "Reviewed estimate and answered questions.", "Left detailed project recap for customer.", "Scheduled follow-up with decision maker."]) : "No answer — left voicemail.",
          followUpRequired: followUp, followUpDate: followUp ? at(2 + Math.floor(rnd() * 6), 10, 0) : null,
          createdAt: startedAt,
        },
      });
    }
  }
  // dispatcher + PM calls
  for (let i = 0; i < 8; i++) {
    const daysAgo = Math.floor(rnd() * 30);
    const startedAt = at(-daysAgo, 7 + Math.floor(rnd() * 4), 30);
    const durationSec = 120 + Math.floor(rnd() * 500);
    await prisma.call.create({
      data: {
        employeeId: emp[i % 2 === 0 ? "EMP-108" : "EMP-106"], customerId: cust[pick(["CUS-1001", "CUS-1005", "CUS-1007", "CUS-1008"])],
        startedAt, endedAt: new Date(startedAt.getTime() + durationSec * 1000), durationSec,
        direction: "OUTGOING", callType: "Dispatch", outcome: "CONNECTED", connected: true,
        notes: "Coordinated crew access and material delivery.", createdAt: startedAt,
      },
    });
  }

  /* -------------------------------- FOLLOW UPS ------------------------------ */
  const followUpSeed: [string, string, string, number, string, string][] = [
    ["LD-1002", "CUS-1002", "EMP-103", -2, "Revised buildout proposal", "Decision maker back from travel — confirm budget approval."],
    ["LD-1003", "CUS-1003", "EMP-105", 0, "Estimate review call", "Walk through shower scope and glass options."],
    ["LD-1007", "CUS-1007", "EMP-103", 1, "Highline board review", "Send after-hours schedule and finalize change order process."],
    ["LD-1008", "CUS-1008", "EMP-105", 3, "Cabinetry selection", "Customer to confirm door style and stain."],
    ["LD-1010", "CUS-1010", "EMP-105", 0, "Basement design options", "Send two layout concepts for family room and bath."],
    ["LD-1011", "CUS-1011", "EMP-103", 2, "HVAC site visit", "Confirm mechanical room access."],
    ["LD-1013", "CUS-1013", "EMP-105", 4, "Architect drawings", "Receive stamped plans and geotech report."],
    ["LD-1014", "CUS-1014", "EMP-103", 1, "Corridor walkthrough", "Meet property manager on site."],
    ["LD-1009", "CUS-1009", "EMP-104", 2, "HOA board presentation", "Prepare phase 2 schedule for board meeting."],
    ["LD-1001", "CUS-1001", "EMP-104", -4, "Kitchen measure", "Completed — measurements and appliance list received."],
  ];
  for (const [leadNo, customerNo, assigned, due, subject, notes] of followUpSeed) {
    await prisma.followUp.create({
      data: {
        leadId: lead[leadNo], customerId: cust[customerNo], assignedToId: emp[assigned],
        dueAt: at(due, 10, 0), subject, notes, status: due < 0 && leadNo === "LD-1001" ? "DONE" : "PENDING",
        completedAt: due < 0 && leadNo === "LD-1001" ? at(-3, 11, 0) : null,
        createdAt: at(Math.min(due - 2, -2), 9, 0),
      },
    });
  }

  /* -------------------------------- ATTENDANCE ------------------------------ */
  const attendanceEmployees = employeeSeed.map((e) => e[0]);
  const today = day(0);
  const attendanceData: {
    employeeId: string; date: Date; clockIn: string | null; clockOut: string | null; breakMins: number;
    totalHours: number; regularHours: number; overtimeHours: number; lateMinutes: number; status: string; notes?: string;
  }[] = [];
  for (let offset = -34; offset <= 0; offset++) {
    const date = day(offset);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;
    for (let i = 0; i < attendanceEmployees.length; i++) {
      const employeeNo = attendanceEmployees[i];
      const seed = Math.abs(offset * 17 + i * 11);
      let status = "PRESENT";
      let clockIn: string | null = iso(7, 55 + (seed % 5));
      let clockOut: string | null = iso(16, 30 + (seed % 20));
      let breakMins = 30;
      let late = 0;
      let notes: string | undefined;

      if (employeeNo === "EMP-113" && offset === -9) { status = "ABSENT"; clockIn = null; clockOut = null; breakMins = 0; notes = "Sick leave — notified supervisor."; }
      else if (employeeNo === "EMP-107" && (offset === -20 || offset === -19)) { status = "LEAVE"; clockIn = null; clockOut = null; breakMins = 0; notes = "Approved PTO."; }
      else if (employeeNo === "EMP-104" && seed % 9 === 0) { status = "LATE"; late = 18 + (seed % 25); clockIn = iso(8, 18 + (seed % 25)); notes = "Late arrival — traffic."; }
      else if (employeeNo === "EMP-112" && seed % 7 === 0) { status = "LATE"; late = 12; clockIn = iso(8, 12); }
      else if (employeeNo === "EMP-105" && offset === -3) { status = "LEAVE"; clockIn = null; clockOut = null; breakMins = 0; notes = "Personal day."; }
      else if (employeeNo === "EMP-102" && seed % 11 === 0) { status = "REMOTE"; clockIn = iso(8, 5); clockOut = iso(16, 45); notes = "Worked remote — office admin."; }

      if (offset === 0 && ["EMP-109", "EMP-110", "EMP-112", "EMP-113"].includes(employeeNo)) {
        clockOut = null;
        status = "PRESENT";
        notes = "On active job site.";
      }

      let totalHours = 0;
      if (clockIn && clockOut) {
        const [h1, m1] = clockIn.split(":").map(Number);
        const [h2, m2] = clockOut.split(":").map(Number);
        totalHours = Math.round(((h2 * 60 + m2 - (h1 * 60 + m1) - breakMins) / 60) * 100) / 100;
      }
      const overtime = Math.max(0, Math.round((totalHours - 8) * 100) / 100);
      attendanceData.push({
        employeeId: emp[employeeNo], date, clockIn, clockOut, breakMins,
        totalHours: Math.max(0, totalHours), regularHours: Math.min(8, Math.max(0, totalHours)),
        overtimeHours: overtime, lateMinutes: late, status,
        notes: notes ?? (overtime > 0 ? "Overtime approved by project manager." : undefined),
      });
    }
  }
  await prisma.attendance.createMany({ data: attendanceData });

  /* ------------------------------- ACTIVITIES ------------------------------- */
  const activityTitles: Record<string, [string, string][]> = {
    CUS_1001: [["LEAD", "Kitchen remodel inquiry received"], ["CALL", "Discovery call with Eleanor — 24 min"], ["NOTE", "Measured kitchen and reviewed appliance list"]],
    CUS_1002: [["LEAD", "Suite 210 buildout referral received"], ["EMAIL", "Sent capability package and references"], ["MEETING", "On-site walkthrough with property manager"]],
    CUS_1003: [["REQUEST", "Website request submitted for bath renovation"], ["CALL", "Discussed walk-in shower options"], ["ESTIMATE", "Estimate EST-3006 sent — viewed by customer"]],
    CUS_1005: [["REQUEST", "Storm damage request received"], ["ESTIMATE", "Roof replacement estimate accepted"], ["PROJECT", "Roofing project mobilized"]],
    CUS_1006: [["CALL", "Panel issue diagnosed by phone"], ["ESTIMATE", "Panel upgrade estimate accepted"], ["PROJECT", "Electrical project completed and inspected"]],
    CUS_1007: [["LEAD", "Dental office renovation inquiry"], ["MEETING", "After-hours site walkthrough"], ["ESTIMATE", "Reception renovation proposal sent"]],
    CUS_1008: [["LEAD", "Kitchen and flooring inquiry"], ["NOTE", "Cabinetry selections pending"], ["PROJECT", "Project flagged delayed — supplier shipment"]],
    CUS_1010: [["REQUEST", "Basement finish request"], ["CALL", "Initial discovery call — 16 min"], ["FOLLOW_UP", "Design concepts promised for this week"]],
    CUS_1013: [["LEAD", "Custom home inquiry"], ["MEETING", "Lot walk with architect"], ["NOTE", "Awaiting stamped drawings and geotech report"]],
  };
  for (const [customerNo, entries] of Object.entries(activityTitles)) {
    let offset = -20;
    for (const [type, title] of entries) {
      await prisma.activity.create({
        data: {
          customerId: cust[customerNo], type, title,
          actorName: customerNo === "CUS_1003" ? "Priya Shah" : customerNo === "CUS_1002" || customerNo === "CUS_1007" ? "Alicia Torres" : "Ryan Cole",
          createdAt: at(offset, 10 + (Math.abs(offset) % 6), 0), description: null,
        },
      });
      offset += 4;
    }
  }
  // generic recent activity for all customers
  for (const [i, customerNo] of customerSeed.entries()) {
    if (activityTitles[`CUS_${customerNo[0].slice(4)}`]) continue;
    await prisma.activity.create({
      data: { customerId: cust[customerNo[0]], type: "NOTE", title: "Customer record reviewed by account team", actorName: "Dana Whitfield", createdAt: at(-(i % 12) - 1, 11, 0) },
    });
  }
  for (const [leadNo, l] of Object.entries(lead)) {
    await prisma.activity.create({
      data: { leadId: l, type: "STATUS", title: `Lead moved to ${leadSeed.find((x) => x[0] === leadNo)![7].replace("_", " ").toLowerCase()}`, actorName: "Alicia Torres", createdAt: minutesAgo(120 + Number(leadNo.slice(-2)) * 30) },
    });
  }

  /* ------------------------------ NOTIFICATIONS ----------------------------- */
  const notifSeed: [string, string, string, string, boolean][] = [
    ["NEW_LEAD", "New website lead — Okafor fence & exterior", "A new quote request came in from Maya Okafor. Response target: 30 minutes.", "/crm/leads", false],
    ["OVERDUE", "Follow-up overdue — Northgate suite 210", "Alicia Torres has an overdue follow-up from 2 days ago.", "/crm/leads", false],
    ["ESTIMATE", "Estimate accepted — Donnelly Roofing", "$24,500 roof replacement was accepted. Ready to convert to a project.", "/crm/estimates", false],
    ["JOB", "Crew dispatched — Donnelly roof tear-off", "James Walker and Andre Lewis are dispatched to 7823 S Franklin Ct.", "/crm/jobs", false],
    ["DELAY", "Project delayed — Okafor Kitchen", "Cabinet shipment delay pushed the completion date. Customer notified.", "/crm/projects", true],
    ["ATTENDANCE", "Attendance exception — Nina Patel", "Absence recorded 9 days ago. Review attendance notes.", "/crm/attendance", true],
    ["REQUEST", "New service request — SR-2007", "Olivia Chen requested an interior repaint via the website.", "/crm/requests", true],
    ["JOB", "Schedule change — Okafor flooring", "Flooring install moved to allow cabinet delivery.", "/crm/jobs", true],
  ];
  for (const [type, title, body, link, read] of notifSeed) {
    await prisma.notification.create({
      data: { userId: users.SUPER_ADMIN, type, title, body, link, read, createdAt: minutesAgo(read ? 2880 : 35 + notifSeed.findIndex((n) => n[1] === title) * 55) },
    });
    if (!read) {
      await prisma.notification.create({
        data: { userId: users.SALES_MANAGER, type, title, body, link, read: false, createdAt: minutesAgo(40) },
      });
    }
  }

  /* --------------------------------- AUDIT ---------------------------------- */
  const auditSeed: [string, string, string | null, string, string | null, string | null][] = [
    ["CREATE", "Leads", "LD-1018", "Created lead from website quote request", null, "Status: NEW"],
    ["UPDATE", "Leads", "LD-1002", "Changed lead status", "QUALIFIED", "NEGOTIATION"],
    ["CREATE", "Estimates", "EST-3005", "Created estimate for Highline Dental", null, "$95,800.00"],
    ["UPDATE", "Estimates", "EST-3001", "Estimate accepted by customer", "SENT", "ACCEPTED"],
    ["LOGIN", "Auth", null, "User signed in", null, "Session created"],
    ["ASSIGN", "Service Requests", "SR-2009", "Assigned request to Alicia Torres", null, "Assigned: EMP-103"],
    ["CREATE", "Jobs", "JOB-5001", "Scheduled roof tear-off", null, "Scheduled today 07:00"],
    ["UPDATE", "Projects", "PRJ-4006", "Project marked delayed", "ACTIVE", "DELAYED"],
    ["UPDATE", "Attendance", "EMP-113", "Attendance exception recorded", null, "ABSENT — sick leave"],
    ["CREATE", "Users", "priya@summitbuilders.com", "Sales representative account created", null, "Role: SALES_REP"],
    ["UPDATE", "Website Content", "home.hero.title", "Homepage hero headline updated", "Building Your Vision From The Ground Up", "Building Your Vision From the Ground Up"],
    ["UPDATE", "Projects", "PRJ-4001", "Progress updated", "45%", "65%"],
    ["LOGOUT", "Auth", null, "User signed out", null, null],
    ["UPDATE", "Leads", "LD-1005", "Lead marked won", "ESTIMATE", "WON"],
  ];
  for (const [i, [action, module, recordId, recordLabel, previousValue, newValue]] of auditSeed.entries()) {
    await prisma.auditLog.create({
      data: {
        userId: users[i % 3 === 0 ? "SALES_MANAGER" : "SUPER_ADMIN"], userName: i % 3 === 0 ? "Alicia Torres" : "Marcus Bennett",
        action, module, recordId, recordLabel, previousValue, newValue,
        ip: "127.0.0.1", userAgent: "Chrome / macOS",
        createdAt: minutesAgo(60 * (i * 7 + 3)),
      },
    });
  }

  /* -------------------------------- EMAIL LOG ------------------------------- */
  await prisma.emailLog.createMany({
    data: [
      {
        to: "marcus@summitbuilders.com", subject: "New quote request — Okafor fence and exterior trim",
        body: "New website quote request\n\nCustomer: Maya Okafor\nPhone: (720) 555-0151\nEmail: maya.okafor@example.com\nService: Exterior & Interior\nUrgency: Normal\nAddress: 1156 S Garfield Street, Denver, CO 80210\n\nCRM: http://localhost:3000/crm/requests",
        relatedType: "ServiceRequest", relatedId: "SR-2008", createdAt: minutesAgo(130),
      },
      {
        to: "maya.okafor@example.com", subject: "We received your project request — Summit Builders",
        body: "Hi Maya,\n\nThank you for contacting Summit Builders. Your request has been received and a project consultant will contact you within one business day. Your reference number is SR-2008.\n\n— Summit Builders",
        relatedType: "ServiceRequest", relatedId: "SR-2008", createdAt: minutesAgo(129), status: "SENT",
      },
      {
        to: "eleanor.hayes@example.com", subject: "Your estimate from Summit Builders — EST-3003",
        body: "Hi Eleanor,\nYour bathroom renovation estimate is ready. Total: $26,500.00. View and approve online or call us with questions.\n\n— Summit Builders",
        relatedType: "Estimate", relatedId: "EST-3003", createdAt: at(-48, 11, 5),
      },
    ],
  });

  /* -----------------──────────── WEBSITE CONTENT ---------------------------- */
  const contentSeed: [string, string, string, string][] = [
    ["company.name", "Summit Builders", "Company", "Company name"],
    ["company.tagline", "Licensed. Insured. Built to last.", "Company", "Tagline"],
    ["company.phone", "(555) 123-4567", "Company", "Phone"],
    ["company.email", "info@summitbuilders.com", "Company", "Email"],
    ["company.address", "1234 Builder Lane, Denver, CO 80204", "Company", "Office address"],
    ["company.hours", "Mon–Fri 7:00am–6:00pm · Sat 8:00am–2:00pm · 24/7 emergency line", "Company", "Business hours"],
    ["company.license", "CO GC License #GC-204918 · Fully bonded & insured", "Company", "License / certification"],
    ["company.founded", "2008", "Company", "Year founded"],
    ["company.social.facebook", "https://facebook.com/summitbuilders", "Social", "Facebook URL"],
    ["company.social.instagram", "https://instagram.com/summitbuilders", "Social", "Instagram URL"],
    ["company.social.linkedin", "https://linkedin.com/company/summitbuilders", "Social", "LinkedIn URL"],
    ["home.hero.eyebrow", "Licensed & insured since 2008", "Homepage", "Hero eyebrow"],
    ["home.hero.title", "Building Your Vision", "Homepage", "Hero headline"],
    ["home.hero.highlight", "From the Ground Up", "Homepage", "Hero highlight line"],
    ["home.hero.subtitle", "From residential renovations to commercial construction, Summit Builders delivers quality craftsmanship, transparent pricing, and dependable timelines.", "Homepage", "Hero subtitle"],
    ["home.hero.image", "/images/hero.jpg", "Homepage", "Hero image path"],
    ["home.intro.title", "Craftsmanship you can stand on.", "Homepage", "Intro heading"],
    ["home.intro.body", "For over 15 years, Summit Builders has helped Colorado homeowners and businesses create spaces that work better and last longer. One accountable team handles design coordination, permitting, construction, and closeout.", "Homepage", "Intro paragraph"],
    ["home.stats.projects", "850+", "Homepage", "Stat — projects completed"],
    ["home.stats.years", "15+", "Homepage", "Stat — years in business"],
    ["home.stats.crew", "32", "Homepage", "Stat — crew members"],
    ["home.stats.satisfaction", "98%", "Homepage", "Stat — satisfaction"],
    ["home.feature1.title", "Licensed & insured", "Homepage", "Feature 1 title"],
    ["home.feature1.body", "Fully licensed, bonded, and insured for your complete peace of mind.", "Homepage", "Feature 1 body"],
    ["home.feature2.title", "On time & on budget", "Homepage", "Feature 2 title"],
    ["home.feature2.body", "Transparent pricing, weekly updates, and schedules we hold ourselves to.", "Homepage", "Feature 2 body"],
    ["home.feature3.title", "One accountable team", "Homepage", "Feature 3 title"],
    ["home.feature3.body", "A dedicated project manager from first walkthrough to final punch list.", "Homepage", "Feature 3 body"],
    ["home.feature4.title", "Skilled crews", "Homepage", "Feature 4 title"],
    ["home.feature4.body", "Certified tradespeople who take pride in the details others miss.", "Homepage", "Feature 4 body"],
    ["about.title", "Built on craftsmanship, run like a business.", "About", "About heading"],
    ["about.body", "Summit Builders started in 2008 with a truck, a set of tools, and a simple promise: do the work right and treat people fairly. Today our team of project managers, tradespeople, and office staff delivers residential and commercial projects across the Front Range — with the same promise.", "About", "About body"],
    ["about.mission", "To make construction feel straightforward: clear scopes, honest budgets, proactive communication, and finishes we're proud to put our name on.", "About", "Mission statement"],
    ["about.experience", "15+ years · 850+ completed projects · $48M+ constructed value", "About", "Experience summary"],
    ["about.values", "Safety first · Do it right · Communicate early · Respect the space", "About", "Company values"],
    ["contact.note", "Tell us about your project and a Summit Builders consultant will get back to you within one business day.", "Contact", "Contact page note"],
    ["footer.note", "Professional construction and contracting services. Licensed, bonded, and insured. Serving the greater Denver metro since 2008.", "Footer", "Footer note"],
    ["seo.title", "Summit Builders — Construction & Remodeling in Denver", "SEO", "Site title"],
    ["seo.description", "Licensed general contractor serving Denver, Boulder, and the Front Range. Kitchens, baths, roofing, commercial buildouts, and custom homes.", "SEO", "Meta description"],
  ];
  for (const [key, value, group, label] of contentSeed) {
    await prisma.websiteContent.create({ data: { key, value, group, label } });
  }

  /* ------------------------------ PORTFOLIO ETC ----------------------------- */
  const portfolioSeed: [string, string, string, string, string, number, boolean][] = [
    ["Hillcrest Whole-Home Renovation", "Residential Remodel", "A tired 1970s ranch reimagined with an open kitchen, new oak floors, and a light-filled primary suite.", "/images/project-house.jpg", "Denver, CO", -70, true],
    ["Boulder Creek Cafe Patio", "Commercial", "A 1,200 sq ft stamped-concrete patio with pergola, planters, and accessible grading for a busy cafe.", "/images/project-patio.jpg", "Boulder, CO", -45, true],
    ["Hayes Primary Bath", "Renovation", "Curbless walk-in shower, custom white oak vanity, and warm tile detailing in a 1950s home.", "/images/project-bath.jpg", "Denver, CO", -30, true],
    ["Modern Chef's Kitchen", "Residential Remodel", "Full-gut kitchen with custom cabinetry, quartz counters, and a redesigned work triangle.", "/images/project-kitchen.jpg", "Centennial, CO", -95, true],
    ["Donnelly Roof Replacement", "Roofing", "Class 4 impact-resistant shingles, new seamless gutters, and upgraded attic ventilation.", "/images/project-roof.jpg", "Centennial, CO", -8, true],
    ["Northgate Suite 210", "Commercial Buildout", "2,400 sq ft office buildout with glass-front meeting rooms, reception millwork, and new MEP.", "/images/project-commercial.jpg", "Denver, CO", -140, true],
  ];
  for (const [i, [title, category, description, imageUrl, location, completedOffset, featured]] of portfolioSeed.entries()) {
    await prisma.portfolioProject.create({
      data: { title, category, description, imageUrl, location, completedAt: day(completedOffset), featured, sortOrder: i, active: true },
    });
  }
  const testimonialSeed: [string, string, string, number][] = [
    ["Eleanor Hayes", "Denver homeowner", "Summit rebuilt our primary bath while we were living in the house. The crew protected our floors, cleaned up every day, and the project finished exactly when they said it would. We've already hired them for the kitchen.", 5],
    ["Chris Nolan", "Northgate Properties", "They understand commercial timelines. Their team worked after hours so our tenants weren't disrupted, and the punch list was closed in three days. That's rare.", 5],
    ["Marla Cheney", "Boulder Creek Cafe", "Our patio went from a muddy slab to the best seat in the neighborhood. Luis kept us informed at every step and the concrete work is flawless.", 5],
    ["Greg Donnelly", "Centennial homeowner", "The roof was replaced in two days, the site was spotless, and they handled the insurance paperwork with us. Honest, responsive, and fairly priced.", 5],
  ];
  for (const [i, [name, company, quote, rating]] of testimonialSeed.entries()) {
    await prisma.testimonial.create({ data: { name, company, quote, rating, sortOrder: i, active: true } });
  }
  for (const [i, [name, state]] of [["Denver", "CO"], ["Aurora", "CO"], ["Lakewood", "CO"], ["Littleton", "CO"], ["Centennial", "CO"], ["Boulder", "CO"], ["Golden", "CO"], ["Arvada", "CO"], ["Greenwood Village", "CO"], ["Highlands Ranch", "CO"]].entries()) {
    await prisma.serviceArea.create({ data: { name, state, sortOrder: i } });
  }

  /* -------------------------------- COUNTERS -------------------------------- */
  const counters: [string, number][] = [
    ["customer", 1014], ["employee", 114], ["lead", 1018], ["request", 2012],
    ["estimate", 3010], ["project", 4009], ["job", 5022],
  ];
  for (const [id, value] of counters) await prisma.counter.create({ data: { id, value } });

  console.log("Seed complete");
  console.log("Users:", userSeed.map(([email]) => email).join(", "));
  console.log("Password for all demo accounts: demo1234");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
