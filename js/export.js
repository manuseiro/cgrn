/**
 * @file export.js — v3.0
 * @description Exportação: CSV, GeoJSON, KML, PNG do mapa.
 * KML adicionado nesta versão (import/export).
 */

import { state }          from './state.js';
import { log, warn, showToast } from './ui.js';
import { glebesToKML }    from './kml.js';
import { conformidadeParaTexto } from './conformidade.js';

function triggerDownload(url, filename) {
  const a = Object.assign(document.createElement('a'),
    { href:url, download:filename, style:'display:none' });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  log('Download:', filename);
}

function ts() {
  const d  = new Date();
  const z  = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}${z(d.getMonth()+1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
}

// ─── CSV ──────────────────────────────────────────────────────────────────

export function exportToCSV(glebas) {
  if (!glebas.length) { showToast('Nenhuma gleba para exportar.','warning'); return; }

  const headers = [
    'Gleba','Área (ha)','Perímetro (m)','Municípios','Semiárido',
    'Bioma','TI Sobreposição','TI Nomes',
    'UC Integral','Embargo IBAMA','Desmatamento PRODES',
    'Conformidade BACEN','Centroid Lat','Centroid Lon',
  ];

  const rows = glebas.map(g => {
    const conf = state.conformidade.get(g.glebaId);
    return [
      g.glebaId,
      g.area.toFixed(6),
      g.perimeter.toFixed(2),
      g.municipioCount,
      g.semiArido === true ? 'Sim' : g.semiArido === false ? 'Não' : '—',
      g.bioma ?? '—',
      g.tiIntersecoes?.length ? 'Sim' : 'Não',
      g.tiIntersecoes?.map(t=>t.nome).join('; ') ?? '',
      conf?.itens?.find(i=>i.id==='uc_integral')?.status ?? '—',
      conf?.itens?.find(i=>i.id==='embargo')?.status ?? '—',
      conf?.itens?.find(i=>i.id==='desmatamento')?.status ?? '—',
      conf?.sintese ?? 'Não verificado',
      g.centroid[1].toFixed(8),
      g.centroid[0].toFixed(8),
    ];
  });

  const totalArea = glebas.reduce((s,g)=>s+g.area, 0);
  rows.push(['TOTAL', totalArea.toFixed(6), '', glebas.length+' gleba(s)','','','','','','','','','','']);

  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
  triggerDownload(URL.createObjectURL(blob), `glebas_${ts()}.csv`);
}

// ─── GeoJSON ──────────────────────────────────────────────────────────────

export function exportToGeoJSON(glebas) {
  if (!glebas.length) { showToast('Nenhuma gleba para exportar.','warning'); return; }

  const conf = state.conformidade;
  const fc = {
    type:'FeatureCollection',
    name:'CGRN_Glebas',
    crs:{type:'name',properties:{name:'urn:ogc:def:crs:OGC:1.3:CRS84'}},
    features: glebas.map(g => ({
      type:'Feature',
      properties:{
        gleba_id:      g.glebaId,
        area_ha:       +g.area.toFixed(6),
        perimetro_m:   +g.perimeter.toFixed(2),
        municipios:    g.municipioCount,
        semiarido:     g.semiArido,
        bioma:         g.bioma ?? null,
        centroid_lat:  g.centroid[1],
        centroid_lon:  g.centroid[0],
        ti_conflito:   !!(g.tiIntersecoes?.length),
        ti_nomes:      g.tiIntersecoes?.map(t=>t.nome).join('; ') ?? '',
        conformidade:  conf.get(g.glebaId)?.sintese ?? 'Não verificado',
        exportado_em:  new Date().toISOString(),
      },
      geometry:{ type:'Polygon', coordinates:[g.geoJsonCoords] },
    })),
  };

  const blob = new Blob([JSON.stringify(fc, null, 2)], {type:'application/geo+json;charset=utf-8;'});
  triggerDownload(URL.createObjectURL(blob), `glebas_${ts()}.geojson`);
}

// ─── KML ──────────────────────────────────────────────────────────────────

export function exportToKML(glebas) {
  if (!glebas.length) { showToast('Nenhuma gleba para exportar.','warning'); return; }

  // Enriquece glebas com dados de conformidade antes de gerar KML
  const glebasEnriquecidas = glebas.map(g => ({
    ...g,
    conformidade: state.conformidade.get(g.glebaId) ?? null,
  }));

  const kml = glebesToKML(glebasEnriquecidas, 'Projeto CGRN');
  const blob = new Blob([kml], {type:'application/vnd.google-earth.kml+xml;charset=utf-8;'});
  triggerDownload(URL.createObjectURL(blob), `glebas_${ts()}.kml`);
  log('KML exportado:', glebas.length, 'glebas');
}

// ─── PNG (mapa) ───────────────────────────────────────────────────────────

export function exportMapImage() {
  if (!window.leafletImage) {
    showToast('Biblioteca leaflet-image não carregada.','danger');
    return;
  }
  leafletImage(state.map, (err, canvas) => {
    if (err) { warn('leaflet-image erro:', err); showToast('Erro ao gerar imagem do mapa.','danger'); return; }
    try {
      triggerDownload(canvas.toDataURL('image/png'), `mapa_glebas_${ts()}.png`);
    } catch(e) {
      showToast('Erro: verifique permissões CORS dos tiles.','danger');
    }
  });
}
