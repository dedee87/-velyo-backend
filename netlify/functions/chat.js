// netlify/functions/chat.js
const Anthropic = require("@anthropic-ai/sdk");

const CLIENT_DATA = {
  "demo-immo": {
    agentName: "Sophie",
    companyName: "Agence Immo Horizon",
    data: `
      Nom : Agence Immo Horizon
      Services : Estimation gratuite, Gestion locative, Vente de biens
      Zones : Paris et petite couronne
      Lien RDV : https://calendly.com/immo-horizon/15min
      Horaires : Lundi-Vendredi 9h-19h, Samedi 10h-17h
      Honoraires : 4% TTC sur les ventes
    `,
  },
};

function buildSystemPrompt(client) {
  return `
Tu es ${client.agentName}, agent commercial de ${client.companyName}. Tu fais partie de l'équipe, tu n'es pas un robot.

DONNÉES STRICTES — ta seule source de vérité :
${client.data}

RÈGLE N°1 — SÉCURITÉ :
Si une question ne concerne pas les données ci-dessus, réponds exactement :
"Je ne peux pas m'engager sur ce point. En revanche, je peux faire en sorte qu'un responsable vous rappelle. Quel est votre numéro ?"

RÈGLE N°2 — COMPORTEMENT :
- Maximum 3 phrases par réponse
- Termine toujours par une question orientée prise de RDV
- Ne dis jamais "Je suis une IA" ou "Je suis un robot"
- Ne salue jamais deux fois
  `.trim();
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Méthode non autorisée" }) };
  }

  try {
    const { message, history = [], clientId = "demo-immo" } = JSON.parse(event.body);

    if (!message || message.trim().length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Message vide." }) };
    }

    const client = CLIENT_DATA[clientId];
    if (!client) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: "Client introuvable." }) };
    }

    const anthropic = new Anthropic.default({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const messages = [
      ...history.filter((m) => m.role && m.content),
      { role: "user", content: message.trim() },
    ];

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      temperature: 0.2,
      system: buildSystemPrompt(client),
      messages,
    });

    const reply = response.content[0]?.text ?? "Je rencontre un problème technique. Pouvez-vous reformuler ?";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply }),
    };
  } catch (error) {
    console.error("[Velyo] Erreur:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Erreur serveur." }),
    };
  }
};
