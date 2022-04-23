const axios = require('axios');
const _ = require('lodash');
const moment = require('moment');
const { ethers } = require('ethers');
const tweet = require('./tweet');
const cache = require('./cache');

const { saveEvent, updateLatestSales } = require('./firestore');

const OPENSEA_API_INTERVAL = 90000;
const DELAY_BETWEEN_API_CALLS = 45000;

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

    console.log(tweetText);

    // OPTIONAL PREFERENCE - don't tweet out sales below X ETH (default is 1 ETH - change to what you prefer)
    // if (Number(formattedEthPrice) < 1) {
    //     console.log(`${assetName} sold below tweet price (${formattedEthPrice} ETH).`);
    //     return;
    // }

    // OPTIONAL PREFERENCE - if you want the tweet to include an attached image instead of just text
    const imageUrl = _.get(event, ['asset', 'image_url']);
    return tweet.tweetWithImage(tweetText, imageUrl);
}

// Poll OpenSea every 90 seconds & retrieve all sales for a given collection in either the time since the last sale OR in the last minute
setInterval(() => {
    const lastSaleTime = cache.get('lastSaleTime', null) || moment().startOf('minute').subtract(89, "seconds").unix();

    console.log(`Last sale (in seconds since Unix epoch): ${cache.get('lastSaleTime', null)}`);

    axios.get('https://api.opensea.io/api/v1/events', {
        headers: {
            'X-API-KEY': process.env.X_API_KEY
        },
        params: {
            collection_slug: process.env.OPENSEA_COLLECTION_SLUG,
            event_type: 'successful',
            occurred_after: lastSaleTime,
            only_opensea: 'false',
        }
    }).then((response) => {
        const events = _.get(response, ['data', 'asset_events']);

        const sortedEvents = _.sortBy(events, function(event) {
            const created = _.get(event, 'created_date');

            return new Date(created);
        })

        console.log(`${events.length} sales since the last one...`);

        // Construct a map of all the sales, so we can just make 1 write
        const salesUpdates = {};

        _.each(sortedEvents, (event) => {
            const created = _.get(event, 'created_date');

            cache.set('lastSaleTime', moment(created).unix());

            // Format and send tweet
            formatAndSendTweet(event);

            // Save to firebase
            saveEvent(event);

            // Add the event to our map
            const tokenId = _.get(event, ['asset', 'token_id']);
            salesUpdates[tokenId] = created;
        });

        // Write the map to Firebase
        updateLatestSales(salesUpdates);
    }).catch((error) => {
        console.error(error);
    });
}, OPENSEA_API_INTERVAL);



setTimeout(() => {

  setInterval(() => {
    const lastTransferTime = cache.get('lastTransferTime', null) || moment().startOf('minute').subtract(89, "seconds").unix();

    console.log(`Last transfer (in seconds since Unix epoch): ${cache.get('lastTransferTime', null)}`);
    axios.get('https://api.opensea.io/api/v1/events', {
      headers: {
        'X-API-KEY': process.env.X_API_KEY
      },
      params: {
        collection_slug: process.env.OPENSEA_COLLECTION_SLUG,
        event_type: 'transfer',
        occurred_after: lastTransferTime,
        only_opensea: 'false',
      }
    }).then((response) => {
      const events = _.get(response, ['data', 'asset_events']);

      const sortedEvents = _.sortBy(events, function(event) {
          const created = _.get(event, 'created_date');

          return new Date(created);
      })

      console.log(`${events.length} transfers since the last one...`);

      _.each(sortedEvents, (event) => {
          const created = _.get(event, 'created_date');

          cache.set('lastTransferTime', moment(created).unix());

          // Save to firebase
          saveEvent(event);
      });
    }).catch((error) => {
        console.error(error);
    });
  }, OPENSEA_API_INTERVAL);
}, DELAY_BETWEEN_API_CALLS);