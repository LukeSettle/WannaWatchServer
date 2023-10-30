//@ts-check
const { CosmosClient } = require('@azure/cosmos');
const config = require('./config');

const client = new CosmosClient({
  endpoint: config.endpoint,
  key: config.key,
  userAgentSuffix: 'CosmosDBJavascriptQuickstart'
});

const getContainer = () => {
  const database = client.database(config.database.id);
  return database.container(config.gamesContainer.id);
};

const fetchGameById = (id) => {
  return getContainer().items
    .query(`SELECT * FROM c WHERE c.id = '${id}'`)
    .fetchAll()
    .then(({ resources }) => resources[0] || null);
};

function upsertGame(game) {
  return fetchGameById(game.id)
    .then(existingGame => {
      if (existingGame) {
        return existingGame;
      }
      return getContainer().items.create(game).then(({ resource }) => resource);
    })
    .catch(error => {
      console.error('Error upserting game:', error);
      throw error;
    });
}

function addPlayerToGame(id, player) {
  return fetchGameById(id)
    .then(existingGame => {
      if (existingGame) {
        // Check if player already exists in the list. Assuming each player has a unique identifier, like an 'id'
        if (existingGame.players && existingGame.players.some(existingPlayer => existingPlayer.id === player.id)) {
          return existingGame;  // return existing game if player is already present
        }

        // Add player to the list if not already present
        const updatedGame = {
          ...existingGame,
          players: [...(existingGame.players || []), player]
        };

        return getContainer().items.upsert(updatedGame).then(({ resource }) => resource);
      }
      throw new Error('Game not found');
    })
    .catch(error => {
      console.error('Error adding player to game attributes:', error);
      throw error;
    });
}


function removePlayerFromGame(id, playerId) {
  return fetchGameById(id)
    .then(existingGame => {
      if (existingGame) {
        const updatedPlayers = existingGame.players.filter(p => p.id !== playerId);
        const updatedGame = { ...existingGame, players: updatedPlayers };
        return getContainer().items.upsert(updatedGame).then(({ resource }) => resource);
      }
      throw new Error('Game not found');
    })
    .catch(error => {
      console.error('Error removing player from game attributes:', error);
      throw error;
    });
}

function setPlayerReady(id, playerId) {
  return fetchGameById(id)
    .then(existingGame => {
      if (existingGame) {
        const updatedPlayers = existingGame.players.map(p =>
          p.id === playerId ? { ...p, isReady: true } : p // assuming player has an id field
        );
        const updatedGame = { ...existingGame, players: updatedPlayers };
        return getContainer().items.upsert(updatedGame).then(({ resource }) => resource);
      }
      throw new Error('Game not found');
    })
    .catch(error => {
      console.error('Error marking player as ready:', error);
      throw error;
    });
}

function startGame(id) {
  return fetchGameById(id)
    .then(existingGame => {
      if (existingGame) {
        const updatedGame = { ...existingGame, started: true };
        return getContainer().items.upsert(updatedGame).then(({ resource }) => resource);
      }
      throw new Error('Game not found');
    })
    .catch(error => {
      console.error('Error starting game:', error);
      throw error;
    });
}

function markUserAsFinishedMatching(id, playerId, liked_movie_ids) {
  return fetchGameById(id)
    .then(existingGame => {
      if (existingGame) {
        const updatedPlayers = existingGame.players.map(p =>
          p.id === playerId ? { ...p, liked_movie_ids, finished: true } : p
        );
        const gameFinished = updatedPlayers.every(p => p.finished);
        const updatedGame = { ...existingGame, players: updatedPlayers, finished: gameFinished };
        return getContainer().items.upsert(updatedGame).then(({ resource }) => resource);
      }
      throw new Error('Game not found');
    })
    .catch(error => {
      console.error('Error marking player as ready:', error);
      throw error;
    });
}

module.exports = {
  upsertGame,
  addPlayerToGame,
  removePlayerFromGame,
  setPlayerReady,
  startGame,
  markUserAsFinishedMatching,
};
