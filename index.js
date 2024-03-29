const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();

const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Password}@cluster0.pxltn.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized access" });
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    // console.log(req.decoded);
    next();
  });
}
async function run() {
  try {
    await client.connect();
    const serviceCollection = client.db("assignment_12").collection("services");

    const userCollection = client.db("assignment_12").collection("users");
    const ordersCollection = client.db("assignment_12").collection("orders");
    const ratingsCollection = client.db("assignment_12").collection("ratings");
    const paymentCollection = client.db("assignment_12").collection("payments");

    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    };

    app.get("/user", verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log(email);
      if (email === undefined || email === "") {
        const query = {};
        const cursor = userCollection.find(query);
        const user = await cursor.toArray();
        res.send(user);
      } else {
        const query = { email: email };
        const cursor = userCollection.find(query);
        const user = await cursor.toArray();
        res.send(user);
      }
    });

    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.put(
      "/user/removeAdmin/:email",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const filter = { email: email };
        const updateDoc = {
          $set: { role: "" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = req.body;
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "24h" }
      );
      res.send({ result, token });
    });

    app.post("/service", verifyJWT, async (req, res) => {
      const newTools = req.body;
      const result = await serviceCollection.insertOne(newTools);
      res.send(result);
    });
    app.post("/rating", verifyJWT, async (req, res) => {
      const newTools = req.body;
      const result = await ratingsCollection.insertOne(newTools);
      res.send(result);
    });
    app.get("/rating", async (req, res) => {
      const query = {};
      const cursor = ratingsCollection.find(query);
      const products = await cursor.toArray();
      res.send(products);
    });

    app.put("/user/update/:email", async (req, res) => {
      const email = req.params.email;
      const users = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          name: users.name,
          phone: users.phone,
          address: users.address,
        },
      };

      const result = await userCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      return res.send({ success: true, result });
    });

    app.get("/service", async (req, res) => {
      const id = req.query.id;
      if (id !== undefined) {
        const id = req.query.id;
        const cursor = serviceCollection.find({ _id: ObjectId(id) });
        const products = await cursor.toArray();
        res.send(products);
      } else {
        const query = {};
        const cursor = serviceCollection.find(query);
        const products = await cursor.toArray();
        res.send(products);
      }
    });

    app.put("/service", async (req, res) => {
      const id = req.query.id;
      const updatedProduct = req.body;
      console.log(updatedProduct, id);
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          price: updatedProduct.price,
          quantity: updatedProduct.quantity,
          minOrderQuantity: updatedProduct.minOrderQuantity,
          image: updatedProduct.image,
        },
      };
      const result = await serviceCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    app.put("/service/:id", async (req, res) => {
      const _id = req.params.id;
      const updatedProduct = req.body;
      console.log(updatedProduct, _id);
      const filter = { _id: ObjectId(_id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          quantity: updatedProduct.quantity,
        },
      };
      const result = await serviceCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    app.put("/order", async (req, res) => {
      const _id = req.query.id;
      const updatedProduct = req.body;
      const filter = { _id: ObjectId(_id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: updatedProduct.status,
        },
      };
      const result = await ordersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    // payment order
    app.patch("/order/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };

      const result = await paymentCollection.insertOne(payment);
      const updatedBooking = await ordersCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(updatedBooking);
    });
    app.get("/order/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const order = await ordersCollection.findOne(query);
      res.send(order);
    });
    app.get("/purchase/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await serviceCollection.findOne(query);
      res.send(result);
    });
    // payment
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const service = req.body;
      const totalPrice = service.totalPrice;
      const amount = totalPrice * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    app.post("/order", async (req, res) => {
      const product = req.body;
      const result = await ordersCollection.insertOne(product);
      res.send(result);
    });
    app.get("/order", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (email !== undefined) {
        const query = { email: email };
        const cursor = ordersCollection.find(query);
        const products = await cursor.toArray();
        res.send(products);
      } else {
        const query = {};
        const cursor = ordersCollection.find(query);
        const products = await cursor.toArray();
        res.send(products);
      }
    });

    app.delete("/order", async (req, res) => {
      const _id = req.query.id;
      console.log(_id);
      const result = await ordersCollection.deleteOne({ _id: ObjectId(_id) });
      res.send(result);
    });

    app.delete("/service", async (req, res) => {
      const _id = req.query.id;
      console.log(_id);
      const result = await serviceCollection.deleteOne({ _id: ObjectId(_id) });
      res.send(result);
    });
  } finally {
  }
}

run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("this is from asssignment 12 server!");
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
