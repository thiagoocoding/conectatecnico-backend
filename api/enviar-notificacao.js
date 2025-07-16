// Ficheiro: functions/enviar-notificacao.js
// Este ficheiro deve estar dentro de uma pasta chamada "functions" no seu novo projeto Netlify.

const admin = require('firebase-admin');

// INICIALIZAÇÃO DO FIREBASE ADMIN
// Esta parte só é executada uma vez para otimizar a função.
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
} catch (e) {
  console.error('Falha na inicialização do Firebase Admin:', e);
}

// FUNÇÃO PRINCIPAL QUE O NETLIFY VAI EXECUTAR
exports.handler = async function(event, context) {
  // 1. Permitir apenas requisições do tipo POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método não permitido. Utilize POST.' }),
    };
  }

  // 2. Extrair os dados da requisição
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (error) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Corpo da requisição inválido.' }) };
  }
  
  const { idFuncionario, novoAtendimento } = body;

  if (!idFuncionario || !novoAtendimento) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Faltam dados essenciais (idFuncionario, novoAtendimento).' }),
    };
  }

  console.log(`Recebido pedido para notificar o funcionário: ${idFuncionario}`);

  // 3. Lógica para enviar a notificação
  try {
    const userDoc = await admin.firestore().collection("users").doc(String(idFuncionario)).get();

    if (!userDoc.exists || !userDoc.data().fcmToken) {
      console.log(`Técnico ${idFuncionario} não encontrado ou sem token.`);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Técnico não encontrado ou sem token FCM registado.' }),
      };
    }

    const fcmToken = userDoc.data().fcmToken;

    const mensagem = {
      notification: {
        title: "Novo Atendimento Atribuído!",
        body: `OS: ${novoAtendimento.numero_os || 'N/D'} - ${novoAtendimento.nome || 'Cliente'}`,
      },
      data: {
        screen: "AtendimentoDetail",
        atendimentoId: String(novoAtendimento.id),
      },
      token: fcmToken,
      android: { priority: "high" },
    };

    await admin.messaging().send(mensagem);
    console.log("Notificação enviada com sucesso!");

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Notificação enviada!' }),
    };

  } catch (error) {
    console.error("Erro ao enviar notificação:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Falha interna ao processar o envio da notificação.' }),
    };
  }
};
