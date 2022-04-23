const axios = require('axios');
const _ = require('lodash');
const moment = require('moment');
const { ethers } = require('ethers');
const tweet = require('./tweet');
const cache = require('./cache');

// Format tweet text
function formatAndSendTweet(event) {
    // Handle both individual items + bundle sales
    const assetName = _.get(event, ['asset', 'name'], _.get(event, ['asset_bundle', 'name']));
    const openseaLink = _.get(event, ['asset', 'permalink'], _.get(event, ['asset_bundle', 'permalink']));

    const totalPrice = _.get(event, 'total_price');

    const tokenDecimals = _.get(event, ['payment_token', 'decimals']);
    const tokenUsdPrice = _.get(event, ['payment_token', 'usd_price']);
    const tokenEthPrice = _.get(event, ['payment_token', 'eth_price']);

    const formattedUnits = ethers.utils.formatUnits(totalPrice, tokenDecimals);
    const formattedEthPrice = formattedUnits * tokenEthPrice;
    const formattedUsdPrice = formattedUnits * tokenUsdPrice;

    const user = _.get(event, ['winner_account', 'user', 'username'], _.get(event, ['winner_account', 'address'], null));
    const userUrl = user ? ` by https://opensea.io/${user}` : '';

    const tweetText = `#${assetName} bought for ${formattedEthPrice}${ethers.constants.EtherSymbol} ($${Number(formattedUsdPrice).toFixed(2)})${userUrl} #NFT #FWENCLUB ${openseaLink}`;

    console.log(_.get(event, 'created_date'), tweetText);

    // OPTIONAL PREFERENCE - don't tweet out sales below X ETH (default is 1 ETH - change to what you prefer)
    // if (Number(formattedEthPrice) < 1) {
    //     console.log(`${assetName} sold below tweet price (${formattedEthPrice} ETH).`);
    //     return;
    // }

    // OPTIONAL PREFERENCE - if you want the tweet to include an attached image instead of just text
    const imageUrl = _.get(event, ['asset', 'image_url']);
    return tweet.tweetWithImage(tweetText, imageUrl);
}

let cursor = undefined;

let allEvents = [];

// // Poll OpenSea every 60 seconds & retrieve all sales for a given collection in either the time since the last sale OR in the last minute
const intervalId = setInterval(() => {
    axios.get('https://api.opensea.io/api/v1/events', {
        headers: {
            'X-API-KEY': process.env.X_API_KEY
        },
        params: {
            collection_slug: process.env.OPENSEA_COLLECTION_SLUG,
            event_type: 'successful', // or 'transfer'
            occurred_after: 1650464679,
            only_opensea: 'false',
            // For pagination, to intialize the feed
            cursor,
        }
    }).then((response) => {
        const events = _.get(response, ['data', 'asset_events']);
        cursor = _.get(response, ['data', 'next']);

        allEvents = [...allEvents, ...events];

        if (!cursor) {
          clearInterval(intervalId);
        }
    }).catch((error) => {
        console.error(error);
    });
}, 1000);


let sortedEvents = [];
setTimeout(() => {
  const sortedEvents = _.sortBy(allEvents, function(event) {
    const created = _.get(event, 'created_date');

    return new Date(created);
  })

  const sortedUniqueEvents = _.sortedUniqBy(sortedEvents, event => event.created_date)
  console.log(sortedUniqueEvents.length);

  let i = 0;
  const tweetInterval = setInterval(() => {
    const tweetThisEvent = sortedUniqueEvents[i];
    formatAndSendTweet(tweetThisEvent);
    i++;

    if (i >=sortedUniqueEvents.length) {
      clearInterval(tweetInterval);
    }
  }, 3000)
}, 10000)
