const express = require('express');
const { WebPubSubServiceClient } = require('@azure/web-pubsub');
const { WebPubSubEventHandler } = require('@azure/web-pubsub-express');

const app = express();
const hubName = 'Sample_ChatApp';
const port = 8080;

let serviceClient = new WebPubSubServiceClient(process.env.WebPubSubConnectionString, hubName);
let handler = new WebPubSubEventHandler(hubName, {
  path: '/eventhandler',
  onConnected: async req => {
    console.log('onConnected', req);
    const groupId = req.context.userId.split('--')[1];
    const displayName = req.context.userId.split('--')[2];

    const groupClient = serviceClient.group(groupId);
    await groupClient.addUser(req.context.userId);

    console.log(`${displayName} joined`);
    await groupClient.sendToAll({
      type: "system",
      message: `${displayName} joined`
    });
  },
  handleUserEvent: async (req, res) => {
    console.log('handleUserEvent', req, res);
    if (req.context.eventName === 'message') {
      const groupId = req.context.userId.split('--')[1];
      const displayName = req.context.userId.split('--')[2];
      const groupClient = serviceClient.group(groupId);

      await groupClient.sendToAll({
        from: displayName,
        type: 'user',
        message: req.data
      });
    }
    res.success();
  }
});

app.get('/negotiate', async (req, res) => {
  console.log('negotiate yaaa', req.query.id);
  let id = req.query.id;

  if (!id) {
    res.status(400).send('missing user id');
    return;
  }
  let token = await serviceClient.getClientAccessToken({ userId: id });
  console.log('negotiated yeeeahh');
  res.json({
    url: token.url
  });
});

app.use(handler.getMiddleware());
app.use(express.static('public'));
app.listen(8080, () => console.log('server started'));