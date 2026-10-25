
const BASE = "https://resultados.tse.jus.br/oficial/ele2026/6258/dados";

const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

function unavailable(message) {
  return {
    status: "unavailable",
    source: "TSE — apuração presidencial 2026",
    updatedAt: null,
    national: null,
    states: [],
    municipalities: [],
    abroad: [],
    message
  };
}

function readVotes(json) {
  const groups = json?.carg || [];

  for (const office of groups) {
    const candidates = [];

    for (const coalition of office.agr || []) {
      for (const party of coalition.par || []) {
        candidates.push(...(party.cand || []));
      }
    }

    const findCandidate = number =>
      candidates.find(c =>
        String(c.n ?? c.nr ?? c.numero) === number
      );

    const lula = findCandidate("13");
    const flavio = findCandidate("22");

    if (!lula || !flavio) continue;

    const a = Number(lula.vap);
    const b = Number(flavio.vap);

    if (
      Number.isSafeInteger(a) &&
      Number.isSafeInteger(b) &&
      a >= 0 &&
      b >= 0
    ) {
      return { lula: a, bolsonaro: b };
    }
  }

  return null;
}

async function load(scope) {
  const uf = scope.toLowerCase();
  const file = `${uf}-c0001-e006258-u.json`;

  const response = await fetch(
    `${BASE}/${uf}/${file}`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000)
    }
  );

  if (!response.ok) {
    throw new Error(`${scope}: HTTP ${response.status}`);
  }

  return response.json();
}

export default async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=45, stale-while-revalidate=45"
  );

  try {
    const br = await load("br");
    const national = readVotes(br);

    if (!national || national.lula + national.bolsonaro === 0) {
      return res.status(200).json(
        unavailable("Aguardando votos oficiais validados do TSE.")
      );
    }

    const responses = await Promise.allSettled(UFS.map(load));

    const states = responses.flatMap((result, index) => {
      if (result.status !== "fulfilled") return [];

      const votes = readVotes(result.value);

      return votes
        ? [{
            uf: UFS[index],
            name: UFS[index],
            ...votes,
            progress: null
          }]
        : [];
    });

    return res.status(200).json({
      status: "live",
      source: "TSE — apuração presidencial 2026",
      updatedAt: new Date().toISOString(),
      national: { ...national, progress: null },
      states,
      municipalities: [],
      abroad: [],
      message: "Resultados consultados na fonte oficial."
    });

  } catch (error) {
    return res.status(200).json(
      unavailable("Fonte oficial indisponível: " + error.message)
    );
  }
}
