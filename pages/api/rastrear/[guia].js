// Endpoint público (sin login) para que el cliente final rastree su paquete
// usando el número de guía o el código de cliente (CLI-xxxxx).
// Solo hace SELECT, nunca modifica nada en la base de datos.
const { query } = require('../../../lib/db');

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { guia } = req.query;
  const valor = (guia || '').trim();

  if (!valor) {
    return res.status(400).json({ error: 'Falta el número de guía o código de rastreo' });
  }

  // Normalizamos: mayúsculas y sin espacios/guiones/puntos, para que no importe
  // si la clienta lo escribe distinto a como quedó capturado (mayúsculas,
  // espacios de más, guiones, etc.) — solo el código QR del cliente coincidía
  // siempre porque ese se escanea sin margen de error de captura.
  const valorNormalizado = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');

  const { rows } = await query(
    `SELECT p.*,
            c.nombre AS cliente_nombre,
            v.nombre AS vendedor_nombre,
            pa.nombre AS paqueteria_nombre
       FROM paquetes p
       JOIN clientes c ON c.id = p.cliente_id
       JOIN vendedores v ON v.id = p.vendedor_id
       LEFT JOIN paqueterias pa ON pa.id = p.paqueteria_id
      WHERE (p.numero_guia IS NOT NULL AND UPPER(REGEXP_REPLACE(p.numero_guia, '[^A-Za-z0-9]', '', 'g')) = $1)
         OR UPPER(REGEXP_REPLACE(c.qr_codigo, '[^A-Za-z0-9]', '', 'g')) = $1
      ORDER BY p.capturado_en DESC
      LIMIT 5`,
    [valorNormalizado]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'No encontramos ningún paquete con ese número de guía o código' });
  }

  const paquetes = await Promise.all(
    rows.map(async (p) => {
      const hist = await query(
        'SELECT estado, creado_en FROM estado_historial WHERE paquete_id = $1 ORDER BY creado_en ASC',
        [p.id]
      );
      return {
        id: p.id,
        cliente_nombre: p.cliente_nombre,
        vendedor_nombre: p.vendedor_nombre,
        paqueteria_nombre: p.paqueteria_nombre,
        numero_guia: p.numero_guia,
        estado: p.estado,
        capturado_en: p.capturado_en,
        foto: p.foto,
        historial: hist.rows,
      };
    })
  );

  return res.status(200).json({ paquetes });
}
