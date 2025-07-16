// ficheiro: api/enviar-notificacao.js

// 1. Importar a biblioteca do Firebase
const admin = require('firebase-admin');

// 2. Carregar as credenciais de forma segura (vamos configurar isto na Vercel)
try {
  if (!admin.apps.length) { // Evita que o app seja inicializado múltiplas vezes
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
} catch (error) {
  console.error('Falha na inicialização do Firebase Admin:', error);
}

// 3. Esta é a função que a Vercel vai executar
module.exports = async (request, response) => {
  // Permitir apenas requisições do tipo POST
  if (request.method !== 'POST') {
    return response.status(405).send({ error: 'Método não permitido' });
  }

  const { idFuncionario, novoAtendimento } = request.body;

  if (!idFuncionario || !novoAtendimento) {
    return response.status(400).send({ error: "Faltam dados essenciais." });
  }

  console.log(`Recebido pedido para notificar o funcionário: ${idFuncionario}`);

  try {
    const userDoc = await admin.firestore().collection("users").doc(String(idFuncionario)).get();

    if (!userDoc.exists || !userDoc.data().fcmToken) {
      console.log(`Técnico ${idFuncionario} não encontrado ou sem token.`);
      return response.status(404).send({ error: "Técnico não encontrado ou sem token." });
    }

    const fcmToken = userDoc.data().fcmToken;

    const mensagem = {
      notification: {
        title: "Novo Atendimento Atribuído!",
        body: `OS: ${novoAtendimento.numero_os} - ${novoAtendimento.nome}`,
      },
      data: {
        screen: "AtendimentoDetail",
        atendimentoId: String(novoAtendimento.id),
        // ... outros dados ...
      },
      token: fcmToken,
      android: { priority: "high" },
    };

    await admin.messaging().send(mensagem);
    console.log("Notificação enviada com sucesso!");

    return response.status(200).send({ success: true, message: "Notificação enviada!" });

  } catch (error) {
    console.error("Erro ao enviar notificação:", error);
    return response.status(500).send({ error: "Falha ao enviar notificação." });
  }
};
