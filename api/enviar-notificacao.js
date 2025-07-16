// ficheiro: api/enviar-notificacao.js

// 1. Importar a biblioteca do Firebase
const admin = require('firebase-admin');

// 2. Carregar as credenciais a partir de variáveis de ambiente separadas
try {
  // Evita que o app seja inicializado múltiplas vezes em ambientes de desenvolvimento
  if (!admin.apps.length) { 
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // A chave privada precisa de um tratamento especial para restaurar as quebras de linha
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
} catch (error) {
  console.error('Falha na inicialização do Firebase Admin:', error);
  // Se a inicialização falhar, a função não pode continuar.
  // Lançar o erro pode ajudar a Vercel a reportar uma falha na função.
}

// 3. Esta é a função serverless que a Vercel vai executar
module.exports = async (request, response) => {
  // Permitir apenas requisições do tipo POST
  if (request.method !== 'POST') {
    return response.status(405).send({ error: 'Método não permitido. Utilize POST.' });
  }

  // Extrair os dados do corpo da requisição
  const { idFuncionario, novoAtendimento } = request.body;

  // Validar se os dados essenciais foram recebidos
  if (!idFuncionario || !novoAtendimento) {
    return response.status(400).send({ error: "Faltam dados essenciais na requisição (idFuncionario, novoAtendimento)." });
  }

  console.log(`Recebido pedido para notificar o funcionário: ${idFuncionario}`);

  try {
    // Procurar o documento do utilizador no Firestore para obter o token do telemóvel
    const userDoc = await admin.firestore().collection("users").doc(String(idFuncionario)).get();

    // Verificar se o utilizador existe e se tem um token FCM
    if (!userDoc.exists || !userDoc.data().fcmToken) {
      console.log(`Técnico ${idFuncionario} não encontrado ou não tem um token FCM.`);
      return response.status(404).send({ error: "Técnico não encontrado ou sem token FCM registado." });
    }

    const fcmToken = userDoc.data().fcmToken;

    // Montar a mensagem da notificação
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
      android: {
        priority: "high", // Maximiza a chance de entrega imediata no Android
      },
      apns: { // Configuração para dispositivos Apple (iOS)
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
    };

    // Enviar a mensagem através do Firebase Cloud Messaging
    await admin.messaging().send(mensagem);
    console.log("Notificação enviada com sucesso!");
    
    // Retornar uma resposta de sucesso
    return response.status(200).send({ success: true, message: "Notificação enviada!" });

  } catch (error) {
    console.error("Erro detalhado ao enviar notificação:", error);
    // Retornar uma resposta de erro genérica
    return response.status(500).send({ error: "Falha interna ao processar o envio da notificação." });
  }
};