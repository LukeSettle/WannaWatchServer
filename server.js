const express = require('express');
const { WebPubSubServiceClient } = require('@azure/web-pubsub');
const { WebPubSubEventHandler } = require('@azure/web-pubsub-express');
const {
  addPlayerToGame,
  removePlayerFromGame,
  setPlayerReady,
  startGame,
  markUserAsFinishedMatching
} = require('./data/cosmo_client');

const app = express();
const hubName = 'Sample_ChatApp';
const port = 8080;

let serviceClient = new WebPubSubServiceClient(process.env.WebPubSubConnectionString, hubName);
let handler = new WebPubSubEventHandler(hubName, {
  path: '/eventhandler',
  onConnected: async req => {
    const groupId = req.context.userId.split('--')[1];
    const displayName = req.context.userId.split('--')[2];

    const groupClient = serviceClient.group(groupId);
    await groupClient.addUser(req.context.userId);

    const game = await addPlayerToGame(groupId, {
      id: req.context.userId,
      display_name: displayName,
      isReady: false
    });

    await groupClient.sendToAll({
      type: "system",
      message: `${displayName} joined`,
      game: game
    });
  },
  onDisconnected: async req => {
    const groupId = req.context.userId.split('--')[1];
    const displayName = req.context.userId.split('--')[2];

    const groupClient = serviceClient.group(groupId);
    await groupClient.removeUser(req.context.userId);

    const game = await removePlayerFromGame(groupId, req.context.userId);

    await groupClient.sendToAll({
      type: "system",
      message: `${displayName} left`,
      game: game
    });
  },
  handleUserEvent: async (req, res) => {
    if (req.context.eventName === 'message') {
      const groupId = req.context.userId.split('--')[1];
      const displayName = req.context.userId.split('--')[2];
      const groupClient = serviceClient.group(groupId);

      switch (JSON.parse(req.data).message) {
        case 'ready':
          let game = await setPlayerReady(groupId, req.context.userId);
          await groupClient.sendToAll({
            type: "system",
            message: `${displayName} is ready`,
            game: game
          });

          if (game.players.every(p => p.isReady)) {
            await groupClient.sendToAll({
              type: "system",
              message: `Game starting in...`,
              game: game
            });

            [3, 2, 1].forEach(i => {
              setTimeout(() => {
                groupClient.sendToAll({
                  type: "system",
                  message: `${i}...`,
                  game: game
                });
              }, i * 1000);
            });

            game = await startGame(groupId);
            groupClient.sendToAll({
              type: "system",
              message: `Start Matching!`,
              game: game
            });
          }
          break;
        case 'finish_matching':
          console.log('Finished matching');
          const finishedGame = await markUserAsFinishedMatching(groupId, req.context.userId, JSON.parse(req.data).liked_movie_ids);
          await groupClient.sendToAll({
            type: "system",
            message: `${displayName} finished matching`,
            game: finishedGame
          });
          break;

        default:
          break;
      }
    }
    res.success();
  }
});

app.get('/negotiate', async (req, res) => {
  let id = req.query.id;

  if (!id) {
    res.status(400).send('missing user id');
    return;
  }
  let token = await serviceClient.getClientAccessToken({ userId: id });
  res.json({
    url: token.url
  });
});

app.use(handler.getMiddleware());
app.use(express.static('public'));
app.listen(8080, () => console.log('server started'));