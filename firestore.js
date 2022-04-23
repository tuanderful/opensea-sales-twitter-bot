const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

// Initializes the firebase app and exports a
// singleton which can be used to conenct to our firestore.

initializeApp({
  credential: cert({
    type: process.env.FIRESTORE_CERT_TYPE,
    project_id: process.env.FIRESTORE_CERT_PROJECT_ID,
    private_key_id: process.env.FIRESTORE_CERT_PRIVATE_KEY_ID,
    private_key: process.env.FIRESTORE_CERT_PRIVATE_KEY,
    client_email: process.env.FIRESTORE_CERT_CLIENT_EMAIL,
    client_id: process.env.FIRESTORE_CERT_CLIENT_ID,
    auth_uri: process.env.FIRESTORE_CERT_AUTH_URI,
    token_uri: process.env.FIRESTORE_CERT_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIRESTORE_CERT_AUTH_PROVIDER_x509_CERT_URL,
    client_x509_cert_url: process.env.FIRESTORE_CERT_CLIENT_x509_CERT_URL
  }),
});

const db = getFirestore();

// Writes an OpenSea Event object to firestore, 'events' collection
function saveEvent(event) {
  try {
    const {
      asset, // dont write this to the new event
      approved_account: approvedAccount,
      asset_bundle: assetBundle,
      auction_type: auctionType,
      bid_amount: bidAmount,
      contract_address: contractAddress,
      created_date: createdDate,
      custom_event_name: customEventName,
      dev_fee_payment_event: devFeePaymentEvent,
      dev_seller_fee_basis_points: devSellerFeeBasisPoints,
      duration: duration,
      ending_price: endingPrice,
      event_type: eventType,
      from_account: fromAccount,
      id: eventId,
      is_private: isPrivate,
      owner_account: ownerAccount,
      payment_token: paymentToken,
      quantity: quantity,
      seller: seller,
      starting_price: startingPrice,
      to_account: toAccount,
      total_price: totalPrice,
      transaction: transaction,
      winner_account: winnerAccount,
      listing_time: listingTime,
    } = event;
    const { token_id: tokenId = null } = asset ? asset : {};

    const eventObject = {
      approvedAccount,
      assetBundle,
      auctionType,
      bidAmount,
      contractAddress,
      createdDate,
      customEventName,
      devFeePaymentEvent,
      devSellerFeeBasisPoints,
      duration,
      endingPrice,
      eventType,
      fromAccount,
      id: eventId,
      isPrivate,
      ownerAccount,
      paymentToken,
      quantity,
      seller,
      startingPrice,
      toAccount,
      totalPrice,
      transaction,
      winnerAccount,
      listingTime,

      // Items to add to the event that are not on OpenSeaEvent object
      tokenId,
      tokenIds: assetBundle ? assetBundle.assets.map((asset) => asset.token_id) : null,
    };

    db.collection('events').doc(eventId.toString()).set(eventObject);
  } catch (firebaseError) {
    console.error(firebaseError);
    console.log(event);
  }
}

async function updateLatestSales(salesUpdates) {
  try {
    const latestSales = await db.collection('latestEvents').doc('sales').get();

    db.collection('latestEvents').doc('sales').set({
      ...latestSales.data(),
      ...salesUpdates,
    });
  } catch (firebaseError) {
    console.error(firebaseError);
  }
}

module.exports = {
  db: db,
  saveEvent: saveEvent,
  updateLatestSales: updateLatestSales,
};
