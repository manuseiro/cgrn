/**
 * @file conformidade.js — v3.4
 * @description Verificação de conformidade BACEN/SICOR para crédito rural.
 *
 * Base legal:
 *   - Resolução CMN nº 5.081/2023 (Manual SICOR)
 *   - Resolução CMN nº 4.945/2021 (vedações ambientais)
 *   - Resolução BACEN nº 4.527/2016 (CRA — Cédula de Produto Rural)
 *   - Lei nº 12.651/2012 (Código Florestal)
 *   - Lei nº 9.985/2000 (SNUC — Unidades de Conservação)
 *   - Decreto nº 6.040/2007 (Terras Indígenas)
 *
 * Cada item de conformidade tem um dos status:
 *   ✅ 'ok'       — sem irregularidade detectada
 *   ℹ️ 'info'     — informativo/orientativo (não gera ressalva no BACEN)
 *   ⚠️ 'alerta'   — irregularidade que requer análise, mas não bloqueia automaticamente
 *   🚫 'bloqueio' — impede o crédito rural (BACEN)
 *   ⏳ 'pendente' — não foi possível verificar (API indisponível)
 *
 * Melhorias v3.4:
 *   - buildCARItem repassa todos os novos campos de analyzeGlebaInCAR:
 *     uncoveredHa, coverageMelhorCAR, nCARs, coverageIndividual por imóvel
 *   - Compatível com o novo painel do modal em main.js
 */

import { state } from '../utils/state.js';
import { CONFIG } from '../utils/config.js';
import { log, warn } from '../components/ui.js';
import {
  checkDesmatamento,
  checkCAR,
  UC_PROTECAO_INTEGRAL,
} from './camadas_externas.js';
import { getBiomaGleba, BIOMA_REGULACAO } from './bioma.js';
import { checkGlebaICMBio } from './icmbio.js';
import { checkGlebaIbama } from './ibama.js';
import { analyzeGlebaInCAR } from './spatial_analysis.js';

// ─── Tipos de verificação (rótulos UI) ────────────────────────────────────

export const CHECKS = Object.freeze({
  GEOMETRIA: { id: 'geometria', label: 'Geometria do Polígono', ref: 'Res. CMN 5.081/2023' },
  AREA: { id: 'area', label: 'Área da Gleba', ref: 'Res. CMN 5.081/2023 Art. 12' },
  MUNICIPIOS: { id: 'municipios', label: 'Municípios Abrangidos (máx. 4)', ref: 'Manual SICOR §3.4' },
  TI: { id: 'ti', label: 'Terra Indígena (FUNAI)', ref: 'Decreto 6.040/2007 + Res. CMN 4.945' },
  UC_INTEGRAL: { id: 'uc_integral', label: 'UC de Proteção Integral (ICMBio)', ref: 'SNUC Lei 9.985/2000 + Res. CMN 4.945' },
  UC_SUSTENTAVEL: { id: 'uc_sust', label: 'UC de Uso Sustentável', ref: 'SNUC Lei 9.985/2000' },
  EMBARGO: { id: 'embargo', label: 'Embargo IBAMA Ativo', ref: 'Res. CMN 4.945/2021 Art. 5' },
  BIOMA: { id: 'bioma', label: 'Bioma e Marco Legal', ref: 'Res. CMN 4.945/2021' },
  DESMATAMENTO: { id: 'desmatamento', label: 'Alerta de Desmatamento (PRODES)', ref: 'Res. CMN 4.945/2021 Art. 5' },
  SEMIARIDO: { id: 'semiarido', label: 'Região Semiárida (SUDENE)', ref: 'Lei 7.827/1989 + FNE' },
  CAR: { id: 'car', label: 'CAR — Cadastro Ambiental Rural', ref: 'Cód. Florestal Art. 29' },
});

// ─── Resultado de um item de verificação ──────────────────────────────────

/**
 * @typedef {Object} CheckItem
 * @property {string}   id                - Identificador do check
 * @property {string}   label             - Rótulo para exibição
 * @property {string}   ref               - Base legal
 * @property {'ok'|'info'|'alerta'|'bloqueio'|'pendente'} status
 * @property {string}   mensagem          - Detalhes do resultado
 * @property {any[]}    [dados]           - Dados brutos (TIs, UCs, CARs, etc.)
 * @property {number}   [coverage]        - % gleba coberta pela união dos CARs (0–100)
 * @property {number}   [coverageMelhorCAR] - % coberta pelo melhor CAR individual (0–100)
 * @property {number}   [uncoveredHa]     - Hectares da gleba fora de qualquer CAR
 * @property {number}   [carAreaHa]       - Soma das áreas dos CARs detectados (ha)
 * @property {number}   [nCARs]           - Número de imóveis CAR detectados
 */

// ─── Orquestrador principal ────────────────────────────────────────────────

/**
 * Executa a verificação completa de conformidade BACEN/SICOR para uma gleba.
 * As verificações locais são síncronas; as de API são paralelas e têm timeout.
 *
 * @param {GlebaData} gleba
 * @param {object}   [opts]
 * @param {boolean}  [opts.skipApi=false]  - Pula verificações que exigem API
 * @returns {Promise<ConformidadeResult>}
 */
export async function verificarConformidade(gleba, { skipApi = false } = {}) {
  const itens = [];

  // ── Verificações LOCAIS (síncronas) ─────────────────────────────────────
  itens.push(checkGeometria(gleba));
  itens.push(checkArea(gleba));
  itens.push(checkMunicipios(gleba));
  itens.push(checkTI(gleba));
  itens.push(checkSemiArido(gleba));

  // ── Verificações via API (assíncronas e paralelas) ─────────────────────
  if (!skipApi) {
    const [ucRes, embargoRes, biomaRes, desmatRes, carRes] = await Promise.allSettled([
      checkGlebaICMBio(gleba),
      checkGlebaIbama(gleba),
      getBiomaGleba(gleba),
      checkDesmatamento(gleba),
      checkCAR(gleba),
    ]);

    itens.push(buildUCItem(gleba, ucRes));
    itens.push(buildEmbargoItem(gleba, embargoRes));
    itens.push(buildBiomaItem(gleba, biomaRes));
    itens.push(buildDesmatItem(gleba, desmatRes));

    // Interpõe analyzeGlebaInCAR: transforma CARResult[] no objeto de análise
    const carAnalisado = carRes.status === 'fulfilled'
      ? { status: 'fulfilled', value: analyzeGlebaInCAR(gleba, carRes.value) }
      : carRes;

    itens.push(buildCARItem(gleba, carAnalisado));

  } else {
    [CHECKS.UC_INTEGRAL, CHECKS.UC_SUSTENTAVEL, CHECKS.EMBARGO,
    CHECKS.BIOMA, CHECKS.DESMATAMENTO, CHECKS.CAR]
      .forEach(c => itens.push({
        ...c, status: 'pendente',
        mensagem: 'Verificação via API desativada.', dados: [],
      }));
  }

  // ── Resultado consolidado ────────────────────────────────────────────────
  const reprovada = itens.some(i => i.status === 'bloqueio');
  const temAlerta = itens.some(i => i.status === 'alerta');
  const temInfo = itens.some(i => i.status === 'info');
  const temPendente = itens.some(i => i.status === 'pendente');

  const resultado = {
    glebaId: gleba.glebaId,
    reprovada,
    temAlerta,
    temInfo,
    temPendente,
    itens,
    timestamp: new Date().toISOString(),
    sintese: reprovada
      ? `REPROVADA — ${itens.filter(i => i.status === 'bloqueio').map(i => i.label).join(', ')}`
      : temAlerta
        ? 'APROVADA COM RESSALVAS — verificar manualmente'
        : 'SEM RESTRIÇÕES DETECTADAS',
  };

  state.conformidade.set(gleba.glebaId, resultado);
  log(`Conformidade Gleba ${gleba.glebaId}: ${resultado.sintese}`);
  return resultado;
}

// ─── Checks locais ────────────────────────────────────────────────────────

function checkArea(g) {
  const { AREA_MIN_HA, AREA_MAX_HA } = CONFIG.VALIDATION;
  if (g.area < AREA_MIN_HA) {
    return {
      ...CHECKS.AREA, status: 'bloqueio',
      mensagem: `Área de ${g.area.toFixed(4)} ha abaixo do mínimo de ${AREA_MIN_HA} ha.`
    };
  }
  if (g.area > AREA_MAX_HA) {
    return {
      ...CHECKS.AREA, status: 'alerta',
      mensagem: `Área de ${g.area.toFixed(0)} ha acima de ${AREA_MAX_HA} ha — verificar modalidade de crédito.`
    };
  }
  return {
    ...CHECKS.AREA, status: 'ok',
    mensagem: `Área de ${g.area.toFixed(4)} ha dentro dos limites.`
  };
}

function checkMunicipios(g) {
  if (g.municipioCount > CONFIG.VALIDATION.MAX_MUNICIPIOS) {
    return {
      ...CHECKS.MUNICIPIOS, status: 'bloqueio',
      mensagem: `Gleba abrange ${g.municipioCount} municípios (máx. ${CONFIG.VALIDATION.MAX_MUNICIPIOS}).`
    };
  }
  return {
    ...CHECKS.MUNICIPIOS, status: 'ok',
    mensagem: `${g.municipioCount} município(s) — dentro do limite.`
  };
}

function checkTI(g) {
  const hits = g.tiIntersecoes ?? [];
  if (!hits.length) {
    return { ...CHECKS.TI, status: 'ok', mensagem: 'Sem sobreposição com Terras Indígenas.', dados: [] };
  }

  const FASES_BLOQUEIO = ['Regularizada', 'Homologada'];
  const temBloqueio = hits.some(ti => FASES_BLOQUEIO.includes(ti.fase));

  const detalhes = hits.map(ti => `${ti.nome} (${ti.fase || 'fase não informada'})`).join(', ');

  return {
    ...CHECKS.TI, 
    status: temBloqueio ? 'bloqueio' : 'alerta',
    mensagem: `Sobreposição com ${hits.length} Terra(s) Indígena(s): ${detalhes}. ${temBloqueio ? 'BLOQUEIO BACEN/SICOR' : 'Em processo — verificar com jurídico'}`,
    dados: hits
  };
}

function checkSemiArido(g) {
  if (g.semiArido === true) {
    return {
      ...CHECKS.SEMIARIDO, status: 'ok',
      mensagem: 'Gleba localizada na região Semiárida (SUDENE). Elegível para FNE, PRONAFm, PNCF, Projetos Estruturantes, FDNE e etc...'
    };
  }
  if (g.semiArido === false) {
    return {
      ...CHECKS.SEMIARIDO, status: 'ok',
      mensagem: 'Gleba fora do polígono semiárido. Verificar linha de crédito aplicável.'
    };
  }
  return {
    ...CHECKS.SEMIARIDO, status: 'pendente',
    mensagem: 'Situação em relação ao semiárido não pôde ser determinada.'
  };
}
function checkGeometria(g) {
  const { AREA_MIN_HA, AREA_MAX_HA } = CONFIG.VALIDATION;
  if (!g.turfPolygon) {
    return { ...CHECKS.GEOMETRIA, status: 'bloqueio', mensagem: 'Geometria inválida ou ausente.' };
  }
  const kinks = turf.kinks(g.turfPolygon);
  if (kinks.features.length > 0) {
    return { ...CHECKS.GEOMETRIA, status: 'alerta',
      mensagem: `Polígono com ${kinks.features.length} autointerseção(ões).` };
  }
  return { ...CHECKS.GEOMETRIA, status: 'ok', mensagem: 'Geometria válida.' };
}
// ─── Builders para resultados de API ──────────────────────────────────────

function buildUCItem(gleba, ucRes) {
  if (ucRes.status === 'rejected' || !state.ucLoaded) {
    return {
      ...CHECKS.UC_INTEGRAL, status: 'pendente',
      mensagem: 'Camada ICMBio indisponível ou não carregada.', dados: []
    };
  }
  const ucs = ucRes.value ?? [];
  const integral = ucs.filter(u => u.protecaoIntegral);
  const sustent = ucs.filter(u => !u.protecaoIntegral);

  if (integral.length) {
    return {
      ...CHECKS.UC_INTEGRAL, status: 'bloqueio',
      mensagem: `Sobreposição com UC de Proteção Integral: ${integral.map(u => u.nome).join(', ')}.`,
      dados: integral
    };
  }
  if (sustent.length) {
    return {
      ...CHECKS.UC_SUSTENTAVEL, status: 'alerta',
      mensagem: `Sobreposição com UC de Uso Sustentável (pode ser permitido): ${sustent.map(u => u.nome).join(', ')}.`,
      dados: sustent
    };
  }
  return {
    ...CHECKS.UC_INTEGRAL, status: 'ok',
    mensagem: 'Sem sobreposição com Unidades de Conservação.', dados: []
  };
}

function buildEmbargoItem(gleba, res) {
  if (res.status === 'rejected' || !state.ibamaLoaded) {
    return {
      ...CHECKS.EMBARGO, status: 'pendente',
      mensagem: 'Camada IBAMA indisponível ou não carregada.', dados: []
    };
  }
  const embargos = res.value ?? [];
  if (!embargos.length) {
    return {
      ...CHECKS.EMBARGO, status: 'ok',
      mensagem: 'Nenhum embargo IBAMA ativo localizado na área da gleba.', dados: []
    };
  }
  return {
    ...CHECKS.EMBARGO, status: 'bloqueio',
    mensagem: `${embargos.length} embargo(s) ativo(s) na área. AIs: ${embargos.map(e => e.numAI).join(', ')}.`,
    dados: embargos
  };
}

function buildBiomaItem(gleba, res) {
  const bioma = res.status === 'fulfilled' ? res.value : null;
  const reg = bioma ? BIOMA_REGULACAO[bioma] : null;

  if (!bioma) {
    return {
      ...CHECKS.BIOMA, status: 'pendente',
      mensagem: 'Bioma não identificado. Verifique manualmente.', dados: []
    };
  }

  gleba.bioma = bioma;

  let status = 'ok';
  let msg = `Bioma: ${bioma}. Reserva Legal mínima: ${reg?.reservaLegalPct ?? 20}%.`;
  if (reg?.bacenCritico) {
    status = 'alerta';
    msg += reg.marcoCorteLegal
      ? ` Vedado crédito para desmatamento após ${reg.marcoCorteLegal} (Res. CMN 4.945/2021).`
      : ' Bioma com restrições BACEN — verificar histórico de desmatamento.';
  }

  return { ...CHECKS.BIOMA, status, mensagem: msg, dados: [{ bioma, ...reg }] };
}

function buildDesmatItem(gleba, res) {
  if (res.status === 'rejected') {
    return {
      ...CHECKS.DESMATAMENTO, status: 'pendente',
      mensagem: 'API TerraBrasilis/PRODES indisponível. Consulte terrabrasilis.dpi.inpe.br.', dados: []
    };
  }
  const alertas = res.value ?? [];
  if (!alertas.length) {
    return {
      ...CHECKS.DESMATAMENTO, status: 'ok',
      mensagem: 'Nenhum alerta de desmatamento (PRODES/DETER) na área da gleba.', dados: []
    };
  }
  const areaTotal = alertas.reduce((s, a) => s + (a.areaHa ?? 0), 0);
  return {
    ...CHECKS.DESMATAMENTO, status: 'bloqueio',
    mensagem: `${alertas.length} alerta(s) de desmatamento — ~${areaTotal.toFixed(1)} ha comprometidos. Crédito vedado.`,
    dados: alertas
  };
}

/**
 * Constrói o CheckItem do CAR a partir do resultado de analyzeGlebaInCAR.
 * Repassa todos os campos novos para uso no modal (main.js).
 *
 * Campos adicionais ao CheckItem padrão:
 *   coverage          — % da gleba coberta pela união dos CARs
 *   coverageMelhorCAR — % coberta pelo melhor CAR individual
 *   uncoveredHa       — ha da gleba fora de qualquer CAR
 *   carAreaHa         — soma das áreas dos CARs (ha)
 *   nCARs             — número de imóveis detectados
 *
 * @param {GlebaData} gleba
 * @param {{status:'fulfilled'|'rejected', value?: object, reason?: any}} res
 * @returns {CheckItem}
 */
function buildCARItem(gleba, res) {
  if (res.status === 'rejected') {
    return {
      ...CHECKS.CAR,
      status: 'info',
      mensagem: 'API SICAR indisponível no momento. Verifique manualmente em car.gov.br.',
      dados: [],
      coverage: 0,
      coverageMelhorCAR: 0,
      uncoveredHa: gleba.area ?? 0,
      carAreaHa: 0,
      nCARs: 0,
    };
  }

  const a = res.value ?? {};

  return {
    ...CHECKS.CAR,
    // Campos de status/mensagem vindos de analyzeGlebaInCAR
    status: a.status ?? 'pendente',
    mensagem: a.mensagem ?? 'Erro na análise do CAR.',
    dados: a.dados ?? [],
    // Métricas de cobertura — todas expostas para uso no modal
    coverage: a.coverage ?? 0,
    coverageMelhorCAR: a.coverageMelhorCAR ?? 0,
    uncoveredHa: a.uncoveredHa ?? 0,
    carAreaHa: a.carAreaHa ?? 0,
    nCARs: a.nCARs ?? 0,
  };
}

// ─── Exportação de relatório de conformidade ──────────────────────────────

/**
 * Gera texto resumido para exportação CSV/KML.
 * @param {ConformidadeResult} conf
 */
export function conformidadeParaTexto(conf) {
  if (!conf) return 'Não verificado';
  const itens = conf.itens.map(i => `${i.label}: ${i.status.toUpperCase()}`).join(' | ');
  return `${conf.sintese} | ${itens}`;
}