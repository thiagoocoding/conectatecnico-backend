// Ficheiro: api/enviar-notificacao.js
// Este ficheiro deve estar dentro da pasta 'api' do seu projeto de backend.

const admin = require('firebase-admin');

// Tenta inicializar o Firebase Admin apenas se ainda não tiver sido feito.
// Este método robusto usa uma única variável de ambiente codificada em Base64.
try {
  if (!admin.apps.length) {
    // 1. Pega a chave codificada da variável de ambiente da Vercel
    const serviceAccountBase64 = process.env.FIREBASE_CREDENTIALS_BASE64;

    if (!serviceAccountBase64) {
      throw new Error("A variável de ambiente FIREBASE_CREDENTIALS_BASE64 não foi encontrada. Verifique as configurações na Vercel.");
    }

    // 2. Descodifica a chave de Base64 de volta para o formato JSON
    const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(serviceAccountJson);

    // 3. Inicializa o Admin SDK com as credenciais descodificadas
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (error) {
  console.error('Falha crítica na inicialização do Firebase Admin:', error);
}

/**
 * Esta é a função que a Vercel vai executar.
 * Ela é chamada quando o seu sistema principal faz uma requisição POST.
 */
module.exports = async (request, response) => {
  // Garante que apenas requisições do tipo POST são aceites
  if (request.method !== 'POST') {
    return response.status(405).send({ error: 'Método não permitido. Use POST.' });
  }

  // Extrai os dados do corpo da requisição
  const { idFuncionario, novoAtendimento } = request.body;

  // Valida se os dados essenciais foram recebidos
  if (!idFuncionario || !novoAtendimento) {
    return response.status(400).send({ error: "Faltam dados essenciais na requisição (idFuncionario, novoAtendimento)." });
  }

  console.log(`Recebido pedido para notificar o funcionário: ${idFuncionario}`);

  try {
    // Procura o documento do utilizador no Firestore para obter o token do telemóvel
    const userDoc = await admin.firestore().collection("users").doc(String(idFuncionario)).get();

    // Verifica se o utilizador existe e se tem um token FCM
    if (!userDoc.exists || !userDoc.data().fcmToken) {
      console.log(`Técnico ${idFuncionario} não encontrado ou não tem um token FCM.`);
      return response.status(404).send({ error: "Técnico não encontrado ou sem token FCM registado." });
    }

    const fcmToken = userDoc.data().fcmToken;

    // Monta a mensagem da notificação
    const mensagem = {
      notification: {
        title: "Novo Atendimento Atribuído!",
        body: `OS: ${novoAtendimento.numero_os || 'N/D'} - ${novoAtendimento.nome || 'Cliente'}`,
      },
      data: {
        screen: "AtendimentoDetail",
        atendimentoId: String(novoAtendimento.id),
        // Pode adicionar outros campos do atendimento aqui se o seu app precisar
      },
      token: fcmToken,
      android: {
        priority: "high", // Define a prioridade como alta para maximizar a entrega
      },
      apns: { // Configuração para dispositivos Apple (iOS)
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
    };

    // Envia a mensagem através do Firebase Cloud Messaging
    await admin.messaging().send(mensagem);
    console.log("Notificação enviada com sucesso!");
    
    // Retorna uma resposta de sucesso
    return response.status(200).send({ success: true, message: "Notificação enviada!" });

  } catch (error) {
    console.error("Erro detalhado ao enviar notificação:", error);
    // Retorna uma resposta de erro genérica
    return response.status(500).send({ error: "Falha interna ao processar o envio da notificação." });
  }
};
