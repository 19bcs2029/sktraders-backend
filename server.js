var express = require("express");
var app = express();
const path = require("path");
const http = require("http");
const https = require("https");

const checksum_lib = require("./paytm/checksum/checksum");
const PaytmChecksum = require("./paytm/PaytmChecksum/PaytmChecksum");

var bodyParser = require("body-parser");
var server = http.createServer(app);
var cors = require("cors");
var dotenv = require("dotenv");
dotenv.config();

var port = process.env.PORT || 3000;

var urlencodedParser = bodyParser.urlencoded({ extended: false });

app.use(cors());

app.use(express.json({ limit: "1mb" }));
var firebase = require("firebase/app");
require("firebase/auth");
require("firebase/firestore");

var admin = require("firebase-admin");
var serviceAccount = require("./firebase-admin/sk-traders-509b1-firebase-adminsdk-hre96-aa9b9fda00.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://sk-traders-509b1.firebaseio.com",
});

var firebaseConfig = {
  apiKey: "AIzaSyBe3xIEN659DpsbM2_pxBRPmn_Iptxh980",
  authDomain: "sk-traders-509b1.firebaseapp.com",
  databaseURL: "https://sk-traders-509b1.firebaseio.com",
  projectId: "sk-traders-509b1",
  storageBucket: "sk-traders-509b1.appspot.com",
  messagingSenderId: "102149414781",
  appId: "1:102149414781:web:8692971764ad342afff614",
  measurementId: "G-8BZWD82KGZ",
};

firebase.initializeApp(firebaseConfig);

app.post("/payment", (req, res) => {
  console.log("in the payment");
  this.data = req.body;
  res.json({
    status: req.body.status,
    orderID: this.data.odId,
    price: this.data.txnamount,
    cstID: this.data.cstId,
    email: this.data.email,
    mobile: this.data.mob,
    name: this.data.name,
    qty: this.data.qty,
    address: this.data.add,
    cart: this.data.cart,
    headers: req.headers,
  });

  idToken = req.headers.token;

  admin
    .auth()
    .verifyIdToken(idToken)
    .then((decodedToken) => {
      const uid = decodedToken.uid;

      admin
        .auth()
        .createCustomToken(uid)
        .then((customToken) => {
          console.log("Logging in...");
          firebase
            .auth()
            .signInWithCustomToken(customToken)
            .then((userCredential) => {
              // Signed in
              var user = userCredential.user;
              console.log(user);
              // ...
            })
            .catch((error) => {
              var errorCode = error.code;
              var errorMessage = error.message;
              console.log("Error Code: " + errorCode);
              console.log("Error Message: " + errorMessage);
              // ...
            });
        })
        .catch((error) => {
          console.log("Error creating custom token:", error);
        });
    })
    .catch((error) => {
      console.log(error);
    });
});

app.get("/paytm", (req, res) => {
  console.log("In the paytm");
  let params = {};
  (params["MID"] = "NqTKuA63797783011362"),
    (params["WEBSITE"] = "WEBSTAGING"),
    (params["CHANNEL_ID"] = "WEB"),
    (params["INDUSTRY_TYPE_ID"] = "Retail"),
    (params["ORDER_ID"] = this.data.odId),
    (params["CUST_ID"] = this.data.cstId),
    (params["CALLBACK_URL"] =
      "https://sktraders-backend.herokuapp.com/paytm-status"),
    // (params["CALLBACK_URL"] = "http://localhost:" + port + "/paytm-status"),
    (params["EMAIL"] = this.data.email),
    (params["MOBILE_NO"] = this.data.mob),
    (params["TXN_AMOUNT"] = `${this.data.txnamount}`),
    checksum_lib.genchecksum(params, "6%EpAP4s5i4RxbSt", (err, checksum) => {
      var txn_url = "https://securegw-stage.paytm.in/order/process"; // for staging

      // var txn_url = "https://securegw.paytm.in/order/process";

      var form_fields = "";
      for (var x in params) {
        form_fields +=
          "<input type='hidden' name='" + x + "' value='" + params[x] + "' >";
      }
      form_fields +=
        "<input type='hidden' name='CHECKSUMHASH' value='" + checksum + "' >";

      res.writeHead(200, { "Content-Type": "text/html" });
      res.write(
        '<html><head><title>Merchant Checkout Page</title></head><body><center><h1>Please do not refresh this page...</h1></center><form method="post" action="' +
          txn_url +
          '" name="f1">' +
          form_fields +
          '</form><script type="text/javascript">document.f1.submit();</script></body></html>'
      );
      res.end();

      if (err) {
        console.log(err);
      }
    });
});

async function storeData(paytmParams) {
  await firebase
    .firestore()
    .collection("orders")
    .doc(`${paytmParams.body.orderId}`)
    .set({
      customerId: `${paytmParams.body.cstID}`,
      name: `${paytmParams.body.name}`,
      email: `${paytmParams.body.email}`,
      shippingAddress: `${paytmParams.body.address}`,
      mobile: `${paytmParams.body.mobile}`,
      totalPrice: `${paytmParams.body.price}`,
      totalQuantity: `${paytmParams.body.qty}`,
      orderedOn: firebase.firestore.FieldValue.serverTimestamp(),
      orderItems: paytmParams.body.cart,
      processed: false,
      paid: true,
      mode: "Online",
    });

  await firebase
    .firestore()
    .collection("users")
    .doc(`${paytmParams.body.cstID}`)
    .collection("myOrders")
    .doc(`${paytmParams.body.orderId}`)
    .set({
      name: `${paytmParams.body.name}`,
      shippingAddress: `${paytmParams.body.address}`,
      mobile: `${paytmParams.body.mobile}`,
      totalPrice: `${paytmParams.body.price}`,
      totalQuantity: `${paytmParams.body.qty}`,
      orderedOn: firebase.firestore.FieldValue.serverTimestamp(),
      orderItems: paytmParams.body.cart,
      paid: true,
      mode: "Online",
    });

  firebase
    .firestore()
    .collection("users")
    .doc(`${paytmParams.body.cstID}`)
    .update({
      cartItems: firebase.firestore.FieldValue.delete(),
    });

  console.log("Data stored!");
}

app.post("/paytm-status", (req, res) => {
  console.log("in the paytm-status");

  var paytmParams = {};

  /* body parameters */
  paytmParams.body = {
    /* Find your MID in your Paytm Dashboard at https://dashboard.paytm.com/next/apikeys */
    mid: "NqTKuA63797783011362",
    orderId: `${this.data.odId}`,
    price: `${this.data.txnamount}`,
    cstID: this.data.cstId,
    email: this.data.email,
    mobile: this.data.mob,
    name: this.data.name,
    qty: this.data.qty,
    address: this.data.add,
    cart: this.data.cart,
  };

  /**
   * Generate checksum by parameters we have in body
   * Find your Merchant Key in your Paytm Dashboard at https://dashboard.paytm.com/next/apikeys
   */
  PaytmChecksum.generateSignature(
    JSON.stringify(paytmParams.body),
    "6%EpAP4s5i4RxbSt"
  )
    .then((checksum) => {
      /* head parameters */
      paytmParams.head = {
        /* put generated checksum value here */
        signature: checksum,
      };

      /* prepare JSON string for request */
      var post_data = JSON.stringify(paytmParams);

      var options = {
        /* for Staging */
        hostname: "securegw-stage.paytm.in",

        /* for Production */
        //   hostname: 'securegw.paytm.in',

        port: 443,
        path: "/v3/order/status",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": post_data.length,
        },
      };

      // Set up the request
      var response = "";
      var post_req = https.request(options, (post_res) => {
        post_res.on("data", (chunk) => {
          response += chunk;
        });

        post_res.on("end", () => {
          console.log("Response: ", response);
          let resultCode = JSON.parse(response).body.resultInfo.resultCode;

          if (resultCode === "01") {
            console.log("Storing data...");

            storeData(paytmParams)
              .then(() => {
                firebase
                  .auth()
                  .signOut()
                  .then(() => {
                    console.log("Signed out from paytm gateway!!!");
                  })
                  .catch((err) => {
                    console.log("Error logging out: " + err);
                  });
              })
              .catch((err) => {
                console.log(err);
              });
          } else {
            console.log("Transaction failed!");
            firebase
              .auth()
              .signOut()
              .then(() => {
                console.log("Signed out from paytm gateway!!!");
              })
              .catch((err) => {
                console.log("Error logging out: " + err);
              });
          }
        });
      });

      // post the data
      post_req.write(post_data);
      post_req.end();
    })
    .catch((err) => {
      console.log(err);
    });

  res.redirect("https://sk-traders-509b1.web.app/products");
});

server.listen(port, () => {
  console.log("Server is starting = " + port);
});
