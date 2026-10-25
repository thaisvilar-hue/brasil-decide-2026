
/*
 * BRASIL DECIDE 2026
 * API de resultados presidenciais — 2º turno
 *
 * Fonte: arquivos JSON do TSE.
 * Não utiliza votos fictícios.
 */

const BASE =
  "https://resultados.tse.jus.br/oficial/ele2026/6258/dados";

const UFS =
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO"
    .split(" ");

function unavailable(message, metadata = {}) {
  return {
    status: "unavailable",
    source: "TSE — apuração presidencial 2026",
    updatedAt: metadata.updatedAt ?? null,
    national: null,
    states: [],
    municipalities: [],
    abroad: [],
    message
  };
}

// Converte percentuais brasileiros: "42,60" -> 42.6
function parsePercent(value) {
  if (value == null || value === "") return null;

  const number = Number(
    String(value).replace(",", ".")
  );

  if (
    !Number.isFinite(number) ||
    number < 0 ||
    number > 100
  ) {
    return null;
  }

  return number;
}

// Interpreta a data e a hora fornecidas pelo TSE.
function parseOfficialDate(json) {
  const date = json?.dg;
  const time = json?.hg;

  if (!date || !time) return null;

  const match = String(date).match(
    /^(\d{2})\/(\d{2})\/(\d{4})$/
  );

  if (!match) return null;

  const [, day, month, year] = match;

  const iso =
    `${year}-${month}-${day}T${time}-03:00`;

  const timestamp = new Date(iso);

  return Number.isNaN(timestamp.getTime())
    ? null
    : timestamp.toISOString();
}

// Extrai votos dos candidatos 13 e 22.
function readVotes(json) {
  const offices = Array.isArray(json?.carg)
    ? json.carg
    : [];

  for (const office of offices) {
    if (String(office.cd ?? "") !== "1") {
      continue;
    }

    const candidates = [];

    for (const coalition of office.agr || []) {
      for (const party of coalition.par || []) {
        candidates.push(...(party.cand || []));
      }
    }

    const findCandidate = number =>
      candidates.find(candidate =>
        String(
          candidate.n ??
          candidate.nr ??
          candidate.numero
        ) === number
      );

    const lula = findCandidate("13");
    const flavio = findCandidate("22");

    if (!lula || !flavio) return null;

    const lulaVotes = Number(lula.vap);
    const flavioVotes = Number(flavio.vap);

    if (
      !Number.isSafeInteger(lulaVotes) ||
      !Number.isSafeInteger(flavioVotes) ||
      lulaVotes < 0 ||
      flavioVotes < 0
    ) {
      return null;
    }

    return {
      lula: lulaVotes,
      bolsonaro: flavioVotes
    };
  }

  return null;
}

// Consulta um arquivo oficial.
async function load(scope) {
  const uf = scope.toLowerCase();

  const filename =
    `${uf}-c0001-e006258-u.json`;

  const response = await fetch(
    `${BASE}/${uf}/${filename}`,
    {
      headers: {
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(8000)
    }
  );

  if (!response.ok) {
    throw new Error(
      `${scope}: HTTP ${response.status}`
    );
  }

  const json = await response.json();

  if (
    String(json?.ele) !== "6258" ||
    String(json?.t) !== "2"
  ) {
    throw new Error(
      `${scope}: identificação eleitoral inesperada`
    );
  }

  return json;
}

// Endpoint /api/results
export default async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=45, stale-while-revalidate=45"
  );

  try {
    const nationalJson = await load("br");

    const nationalVotes =
      readVotes(nationalJson);

    const progress =
      parsePercent(nationalJson?.pst);

    const updatedAt =
      parseOfficialDate(nationalJson);

    if (!nationalVotes) {
      return res.status(200).json(
        unavailable(
          "O arquivo oficial foi encontrado, mas os votos ainda não puderam ser validados.",
          { updatedAt }
        )
      );
    }

    const totalVotes =
      nationalVotes.lula +
      nationalVotes.bolsonaro;

    // Sem votos: não apresentar percentuais
    // de candidatos nem resultados fictícios.
    if (totalVotes === 0) {
      return res.status(200).json(
        unavailable(
          "Aguardando votos oficiais. O arquivo do TSE ainda apresenta zero votos para os candidatos.",
          { updatedAt }
        )
      );
    }

    // Consultar os estados somente quando
    // houver votos nacionais validados.
    const responses = await Promise.allSettled(
      UFS.map(uf => load(uf))
    );

    const states = responses.flatMap(
      (result, index) => {
        if (result.status !== "fulfilled") {
          return [];
        }

        const votes = readVotes(result.value);

        if (!votes) return [];

        return [{
          uf: UFS[index],
          name: UFS[index],
          ...votes,
          progress: parsePercent(
            result.value?.pst
          )
        }];
      }
    );

    return res.status(200).json({
      status: "live",

      source:
        "TSE — apuração presidencial 2026, 2º turno",

      updatedAt,

      national: {
        ...nationalVotes,
        progress
      },

      states,

      municipalities: [],

      abroad: [],

      message:
        "Dados oficiais consultados. Municípios e exterior ainda não integrados."
    });

  } catch (error) {
    return res.status(200).json(
      unavailable(
        "Não foi possível consultar ou validar a fonte oficial: " +
        error.message
      )
    );
  }
}
