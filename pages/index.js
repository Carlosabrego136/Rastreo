import { useState } from 'react';
import Head from 'next/head';

// Instrucciones específicas por paquetería para cuando su sitio NO permite
// mandar a alguien directo al resultado de la guía (confirmado probando con
// guías reales — ver notas en db/schema.sql del repo principal). En esos
// casos copiamos el número al portapapeles y les decimos exactamente qué
// pegar y dónde, para que no se queden perdidos en un buscador vacío.
const INSTRUCCIONES_COPIA = {
  Estafeta:
    'Se copió tu número de guía. Se va a abrir la página de Estafeta — pégalo (mantén presionado y elige "Pegar") en el buscador y dale a la lupa.',
  Bajapack:
    'Se copió tu número de guía. Se va a abrir la página de Bajapack — pégalo en el buscador y presiona Enter o el botón de buscar.',
  Volaris:
    'Se copió tu número de guía (sin el "036-"). Se va a abrir la página de Volaris — el campo "Prefix" ya trae 036 puesto, solo pega tu número en el campo "AWB No\'s" y dale "Track".',
};
const INSTRUCCION_GENERICA =
  'Se copió tu número de guía. Se va a abrir la página de la paquetería — pégalo en su buscador para ver el estado.';

// Para Volaris el campo de guía en su sitio (Air Waybill) no lleva el prefijo
// "036-" que a veces se captura junto con el número — ese prefijo ya viene
// puesto de fábrica en su formulario, así que si lo copiamos completo sobra.
function guiaParaCopiar(paqueteriaNombre, numeroGuia) {
  if (!numeroGuia) return '';
  if (paqueteriaNombre === 'Volaris') {
    const sinPrefijo = numeroGuia.trim().replace(/^\d{2,4}-/, '');
    return sinPrefijo || numeroGuia;
  }
  return numeroGuia;
}

async function copiarAlPortapapeles(texto) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch (err) {
    // Seguimos al método de respaldo de abajo.
  }
  // Respaldo para navegadores/contextos donde no hay API de portapapeles:
  // un textarea invisible + el comando viejo de copiar.
  try {
    const textarea = document.createElement('textarea');
    textarea.value = texto;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch (err) {
    return false;
  }
}

function BotonPaqueteria({ paqueteriaNombre, numeroGuia, url }) {
  const [aviso, setAviso] = useState('');

  if (!url || !numeroGuia) return null;

  // Si la plantilla trae "{guia}" es porque esa paquetería SÍ deja mandar a
  // alguien directo al resultado — confirmado probando con guías reales.
  if (url.includes('{guia}')) {
    const link = url.replace('{guia}', encodeURIComponent(numeroGuia));
    return (
      <a href={link} target="_blank" rel="noreferrer" className="rastreo-boton-paqueteria">
        Rastrear en {paqueteriaNombre} ↗
      </a>
    );
  }

  // Si no, copiamos la guía y abrimos su página en blanco, con instrucciones
  // claras de qué hacer ahí (cada paquetería es distinta).
  async function alHacerClic() {
    const valor = guiaParaCopiar(paqueteriaNombre, numeroGuia);
    const copiado = await copiarAlPortapapeles(valor);
    setAviso(
      copiado
        ? INSTRUCCIONES_COPIA[paqueteriaNombre] || INSTRUCCION_GENERICA
        : `No pudimos copiar automáticamente. Tu número de guía es: ${valor}`
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="rastreo-paqueteria-manual">
      <button type="button" className="rastreo-boton-paqueteria" onClick={alHacerClic}>
        Copiar guía y abrir {paqueteriaNombre} ↗
      </button>
      {aviso && <p className="rastreo-aviso-copia">{aviso}</p>}
    </div>
  );
}

const VIDEO_FONDO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260808_075824_7c8a2ef3-826c-43ca-81a1-162429faa306.mp4';

const ESTADO_LABEL = {
  recibido: 'Recibido en bodega',
  en_transito: 'En tránsito',
  listo_entrega: 'Listo para entrega',
  entregado: 'Entregado',
};

const ESTADO_ICONO = {
  recibido: '📦',
  en_transito: '🚚',
  listo_entrega: '🏁',
  entregado: '✅',
};

const ORDEN_ESTADOS = ['recibido', 'en_transito', 'listo_entrega', 'entregado'];

function formatoFecha(fechaIso) {
  if (!fechaIso) return '';
  const d = new Date(fechaIso);
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Linea({ paquete }) {
  const pasoActual = ORDEN_ESTADOS.indexOf(paquete.estado);

  const historialPorEstado = {};
  (paquete.historial || []).forEach((h) => {
    if (!historialPorEstado[h.estado]) historialPorEstado[h.estado] = h.creado_en;
  });

  return (
    <div className="rastreo-card">
      <div className="rastreo-card-top">
        <div>
          <div className="rastreo-guia">
            {paquete.paqueteria_nombre || 'Paquete'} {paquete.numero_guia ? `· Guía ${paquete.numero_guia}` : ''}
          </div>
          <div className="rastreo-cliente">Para: {paquete.cliente_nombre}</div>
        </div>
        <span className={`rastreo-badge estado-${paquete.estado}`}>{ESTADO_LABEL[paquete.estado] || paquete.estado}</span>
      </div>

      {paquete.foto ? (
        <img src={paquete.foto} alt="Foto del paquete" className="rastreo-foto" />
      ) : (
        <div className="rastreo-sin-foto">📷 Sin foto disponible para este paquete</div>
      )}

      {paquete.numero_guia && paquete.paqueteria_nombre && (
        <BotonPaqueteria
          paqueteriaNombre={paquete.paqueteria_nombre}
          numeroGuia={paquete.numero_guia}
          url={paquete.paqueteria_url}
        />
      )}

      <div className="rastreo-timeline">
        {ORDEN_ESTADOS.map((estado, i) => {
          const completado = i <= pasoActual;
          const fecha = historialPorEstado[estado];
          return (
            <div key={estado} className={`rastreo-paso ${completado ? 'completado' : ''}`}>
              <div className="rastreo-punto">
                <span>{ESTADO_ICONO[estado]}</span>
              </div>
              {i < ORDEN_ESTADOS.length - 1 && (
                <div className={`rastreo-linea ${i < pasoActual ? 'completado' : ''}`} />
              )}
              <div className="rastreo-paso-texto">
                <div className="rastreo-paso-label">{ESTADO_LABEL[estado]}</div>
                <div className="rastreo-paso-fecha">
                  {fecha ? formatoFecha(fecha) : completado ? formatoFecha(paquete.capturado_en) : 'Pendiente'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Rastrear() {
  const [valor, setValor] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [paquetes, setPaquetes] = useState(null);

  async function buscar(e) {
    e.preventDefault();
    // Quitamos espacios normales y espacios "invisibles" (los que a veces se
    // pegan de WhatsApp o Notas) al principio, en medio y al final, para que
    // no falle la búsqueda solo por un espacio de más.
    const valorLimpio = valor.replace(/[ ​‌‍﻿]/g, ' ').trim();
    if (!valorLimpio) return;
    setBuscando(true);
    setError('');
    setPaquetes(null);
    try {
      const res = await fetch(`/api/rastrear/${encodeURIComponent(valorLimpio)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error ||
            'No encontramos ningún paquete con ese número de guía o código. Verifica que sea exactamente el que te compartieron, sin errores de captura.'
        );
        return;
      }
      setPaquetes(data.paquetes);
    } catch (err) {
      setError('No se pudo conectar. Intenta de nuevo en unos segundos.');
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="rastreo-shell">
      <Head>
        <title>Rastrea tu envío — ENVIOS AYORA</title>
        <link rel="icon" href="/logo.jpg" />
      </Head>

      <video className="rastreo-video" autoPlay loop muted playsInline preload="auto">
        <source src={VIDEO_FONDO} type="video/mp4" />
      </video>

      <div className="rastreo-content">
        <header className="rastreo-header">
          <div className="rastreo-brand">
            <img src="/logo.jpg" alt="ENVIOS AYORA" />
            <span className="rastreo-brand-tag">ENVIOS AYORA</span>
          </div>
        </header>

        <main className="rastreo-main">
          <div className="rastreo-panel">
            <div className="rastreo-hero-texto">
              <span className="rastreo-eyebrow">Rastreo de envíos</span>
              <h1>¿Dónde está tu paquete?</h1>
              <p>Escribe tu número de guía o tu código de cliente para ver el estado de tu envío al instante.</p>
            </div>

            <form className="rastreo-form" onSubmit={buscar}>
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Ej. 1Z999AA10123456784 o CLI-abc123"
                autoCapitalize="characters"
              />
              <button type="submit" className="rastreo-btn" disabled={buscando}>
                {buscando ? 'Buscando...' : 'Rastrear'}
              </button>
            </form>

            {error && <div className="rastreo-error">{error}</div>}
          </div>

          {paquetes && (
            <div className="rastreo-resultados">
              {paquetes.map((p) => (
                <Linea key={p.id} paquete={p} />
              ))}
            </div>
          )}
        </main>

        <footer className="rastreo-footer">ENVIOS AYORA — rastreo de paquetes</footer>
      </div>

      <style jsx global>{`
        html, body {
          background: transparent;
        }
        .rastreo-shell {
          position: relative;
          min-height: 100vh;
        }
        .rastreo-video {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          object-fit: cover;
          z-index: -1;
        }
        .rastreo-content {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          color: #fff;
          display: flex;
          flex-direction: column;
        }
        .rastreo-header {
          padding: 20px 24px 8px;
          display: flex;
          justify-content: center;
        }
        .rastreo-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .rastreo-brand img {
          height: 64px;
          border-radius: 10px;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
        }
        .rastreo-brand-tag {
          display: inline-block;
          padding: 6px 18px;
          border-radius: 999px;
          font-size: 12.5px;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #eef1f6;
          background: linear-gradient(180deg, rgba(40, 48, 66, 0.85) 0%, rgba(15, 19, 28, 0.85) 100%);
          border: 1px solid rgba(199, 205, 216, 0.55);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
        }
        .rastreo-main {
          flex: 1;
          max-width: 640px;
          width: 100%;
          margin: 0 auto;
          padding: 16px 20px 60px;
        }
        .rastreo-panel {
          background: linear-gradient(135deg, #1b2740 0%, #0a1120 100%);
          border: 1px solid rgba(199, 205, 216, 0.35);
          border-radius: 20px;
          padding: 28px 24px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
        }
        .rastreo-hero-texto {
          text-align: center;
          margin-bottom: 28px;
        }
        .rastreo-eyebrow {
          display: inline-block;
          background: rgba(203, 210, 222, 0.15);
          color: #dfe3ea;
          border: 1px solid rgba(203, 210, 222, 0.45);
          border-radius: 999px;
          padding: 5px 14px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 14px;
        }
        .rastreo-hero-texto h1 {
          margin: 0 0 10px;
          font-size: 30px;
          font-weight: 800;
          background: linear-gradient(90deg, #b7bfcc 0%, #ffffff 45%, #9aa4b5 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          filter: drop-shadow(0 2px 10px rgba(0, 0, 0, 0.6));
        }
        .rastreo-hero-texto p {
          margin: 0;
          color: rgba(255, 255, 255, 0.9);
          font-size: 14.5px;
          line-height: 1.5;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
        }
        .rastreo-form {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }
        .rastreo-form input {
          flex: 1;
          padding: 14px 16px;
          border-radius: 10px;
          border: 1px solid rgba(199, 205, 216, 0.35);
          background: #0a1120;
          color: #fff;
          font-size: 15px;
          margin-bottom: 0;
        }
        .rastreo-form input::placeholder { color: rgba(255, 255, 255, 0.45); }
        .rastreo-form input:focus {
          outline: none;
          border-color: #c7cdd8;
        }
        .rastreo-btn {
          padding: 14px 22px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(90deg, #c7cdd8 0%, #ffffff 100%);
          color: #101a30;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          white-space: nowrap;
        }
        .rastreo-btn:hover { filter: brightness(1.05); }
        .rastreo-btn:disabled { opacity: 0.6; cursor: default; }
        .rastreo-error {
          background: rgba(239, 68, 68, 0.18);
          border: 1px solid rgba(239, 68, 68, 0.45);
          color: #fca5a5;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 14px;
          margin-bottom: 16px;
        }
        .rastreo-resultados {
          display: flex;
          flex-direction: column;
          gap: 18px;
          margin-top: 18px;
        }
        .rastreo-card {
          background: linear-gradient(135deg, #16213a 0%, #0a1120 100%);
          border: 1px solid rgba(199, 205, 216, 0.3);
          border-radius: 16px;
          padding: 20px;
        }
        .rastreo-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 14px;
        }
        .rastreo-guia { font-weight: 700; font-size: 15px; }
        .rastreo-cliente { font-size: 13px; color: rgba(255, 255, 255, 0.65); margin-top: 2px; }
        .rastreo-badge {
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }
        .estado-recibido { background: rgba(59, 130, 246, 0.22); color: #93c5fd; }
        .estado-en_transito { background: rgba(246, 168, 63, 0.22); color: #f6a83f; }
        .estado-listo_entrega { background: rgba(16, 185, 129, 0.22); color: #6ee7b7; }
        .estado-entregado { background: rgba(255, 255, 255, 0.18); color: #fff; }
        .rastreo-foto {
          width: 100%;
          max-height: 220px;
          object-fit: cover;
          border-radius: 10px;
          margin-bottom: 16px;
        }
        .rastreo-sin-foto {
          font-size: 12.5px;
          color: rgba(255, 255, 255, 0.55);
          background: rgba(255, 255, 255, 0.06);
          border: 1px dashed rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          padding: 10px 12px;
          margin-bottom: 16px;
          text-align: center;
        }
        .rastreo-paqueteria-manual {
          margin-bottom: 16px;
        }
        .rastreo-boton-paqueteria {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          justify-content: center;
          padding: 11px 16px;
          border-radius: 10px;
          border: 1px solid rgba(199, 205, 216, 0.5);
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          font-size: 13.5px;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
          margin-bottom: 16px;
          font-family: inherit;
        }
        .rastreo-boton-paqueteria:hover {
          background: rgba(255, 255, 255, 0.16);
        }
        .rastreo-paqueteria-manual .rastreo-boton-paqueteria {
          margin-bottom: 8px;
        }
        .rastreo-aviso-copia {
          margin: 0 0 16px;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(110, 231, 183, 0.14);
          border: 1px solid rgba(110, 231, 183, 0.4);
          color: #d1fae5;
          font-size: 12.5px;
          line-height: 1.5;
          text-align: center;
        }
        .rastreo-timeline {
          display: flex;
          flex-direction: column;
        }
        .rastreo-paso {
          display: flex;
          align-items: flex-start;
          position: relative;
          min-height: 56px;
        }
        .rastreo-punto {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          flex-shrink: 0;
          z-index: 1;
          opacity: 0.5;
        }
        .rastreo-paso.completado .rastreo-punto {
          background: linear-gradient(135deg, #c7cdd8 0%, #ffffff 100%);
          border-color: transparent;
          opacity: 1;
        }
        .rastreo-linea {
          position: absolute;
          left: 16px;
          top: 34px;
          width: 2px;
          height: calc(100% - 20px);
          background: rgba(255, 255, 255, 0.18);
        }
        .rastreo-linea.completado { background: #c7cdd8; }
        .rastreo-paso-texto { margin-left: 14px; padding-bottom: 22px; }
        .rastreo-paso-label {
          font-size: 14px;
          font-weight: 700;
          opacity: 0.55;
        }
        .rastreo-paso.completado .rastreo-paso-label { opacity: 1; }
        .rastreo-paso-fecha {
          font-size: 12.5px;
          color: rgba(255, 255, 255, 0.55);
          margin-top: 2px;
        }
        .rastreo-footer {
          text-align: center;
          padding: 20px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }
      `}</style>
    </div>
  );
}
