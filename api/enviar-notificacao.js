// Ficheiro: api/enviar-notificacao.js - VERSÃO FINAL E CORRIGIDA

const admin = require('firebase-admin');

// Tenta inicializar o Firebase Admin apenas se ainda não tiver sido feito.
try {
  if (!admin.apps.length) {
    // Pega as credenciais diretamente das variáveis de ambiente
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!privateKey) {
      throw new Error("A variável de ambiente FIREBASE_PRIVATE_KEY não foi encontrada.");
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // ✅ A CORREÇÃO MÁGICA: Esta linha substitui os caracteres '\\n'
        // pela quebra de linha real '\n', consertando o formato da chave.
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  }
} catch (error) {
  // Este log só aparecerá se houver um erro na inicialização
  console.error('Falha crítica na inicialização do Firebase Admin:', error);
}

// Esta é a função que a Vercel vai executar
module.exports = async (request, response) => {
  // Garante que o Firebase foi inicializado antes de continuar
  if (!admin.apps.length) {
    return response.status(500).send({ error: 'O servidor não conseguiu inicializar o Firebase. Verifique os logs.' });
  }

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
      },
      token: fcmToken,
      android: { priority: "high" },
    };

    await admin.messaging().send(mensagem);
    return response.status(200).send({ success: true, message: "Notificação enviada!" });
  } catch (error) {
    console.error("Erro detalhado ao enviar notificação:", error);
    return response.status(500).send({ error: "Falha ao enviar notificação." });
  }
};
