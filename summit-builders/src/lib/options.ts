import { db } from "@/lib/db";

export async function getFormOptions() {
  const [customers, services, employees, departments, projects, leads, dispatchers, users] = await Promise.all([
    db.customer.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, company: true, phone: true, serviceAddress: true, city: true, state: true, zip: true, assignedRepId: true },
      orderBy: { name: "asc" },
    }),
    db.service.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    db.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, position: true, department: { select: { name: true } } },
      orderBy: { firstName: "asc" },
    }),
    db.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.project.findMany({
      where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
      select: { id: true, projectNo: true, name: true, customerId: true, serviceAddress: true, managerId: true },
      orderBy: { createdAt: "desc" },
    }),
    db.lead.findMany({
      where: { status: { notIn: ["WON", "LOST"] } },
      select: { id: true, leadNo: true, title: true, customerId: true },
      orderBy: { createdAt: "desc" },
    }),
    db.employee.findMany({ where: { status: "ACTIVE", position: { contains: "Dispatcher" } }, select: { id: true, firstName: true, lastName: true } }),
    db.user.findMany({ select: { id: true, employeeId: true } }),
  ]);

  const linkedEmployees = new Set(users.map((u) => u.employeeId).filter(Boolean));

  return {
    customers,
    services,
    employees: employees.map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      position: e.position,
      department: e.department?.name ?? null,
    })),
    salesEmployees: employees
      .filter((e) => ["Sales", "Leadership"].includes(e.department?.name ?? ""))
      .map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, position: e.position })),
    managers: employees
      .filter((e) => e.position.toLowerCase().includes("project manager") || e.position.toLowerCase().includes("operations"))
      .map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, position: e.position })),
    departments,
    projects,
    leads,
    dispatchers,
    linkedEmployees: [...linkedEmployees] as string[],
  };
}

export type FormOptions = Awaited<ReturnType<typeof getFormOptions>>;
