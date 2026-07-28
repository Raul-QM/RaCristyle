import { query } from '../db.js';

const employeeColumns = 'id_empleado, nombre, especialidad, activo';

export async function listEmployeesByBusiness(businessId) {
  const result = await query(
    `SELECT ${employeeColumns}
     FROM empleado WHERE id_negocio = $1 ORDER BY creado_en DESC`,
    [businessId],
  );
  return result.rows;
}

export async function createEmployee(businessId, employee) {
  const result = await query(
    `INSERT INTO empleado (id_negocio, nombre, especialidad)
     VALUES ($1, $2, $3)
     RETURNING ${employeeColumns}`,
    [businessId, employee.nombre, employee.especialidad],
  );
  return result.rows[0];
}

export async function updateEmployee(businessId, employeeId, employee) {
  const result = await query(
    `UPDATE empleado SET nombre = $1, especialidad = $2
     WHERE id_empleado = $3 AND id_negocio = $4
     RETURNING ${employeeColumns}`,
    [employee.nombre, employee.especialidad, employeeId, businessId],
  );
  return result.rows[0] ?? null;
}

export async function setEmployeeActive(businessId, employeeId, active) {
  const result = await query(
    `UPDATE empleado SET activo = $1
     WHERE id_empleado = $2 AND id_negocio = $3
     RETURNING ${employeeColumns}`,
    [active, employeeId, businessId],
  );
  return result.rows[0] ?? null;
}
