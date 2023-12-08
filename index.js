const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cn37c5v.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyJWT = async(req, res, next) => {
  const authorization = await req.headers.authorization;
  console.log("full auth",authorization);
  const restToken = authorization.split(" ")[1];
  console.log("token after split",restToken);
  if (!restToken) {
    return res.status(401).send({ error: true, message: "unauthorization access" });
  }
  
  jwt.verify(restToken, process.env.ACCESS_TOKEN, (err, decoded)=>{
    if(err){
      return res.status(403).send({error: true, message: 'Unauthorized Access'})
    }
    req.decoded = decoded;
    next();
  })
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const serviceCollection = client.db("CarService").collection("Services");
    const bookingCollection = client.db("CarService").collection("bookings");

    // JWT
    app.post("/token", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    // SERVICES APIS
    app.get("/services", async (req, res) => {
      const cursor = serviceCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = {
        projection: { service_id: 1, title: 1, price: 1, img: 1 },
      };
      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    });

    // booking related api
    app.get("/booking",verifyJWT,  async (req, res) => {
      const decoded = req.decoded;
      console.log(decoded.loggedUser);
      if(decoded.loggedUser !== req.query.email){
        return res.status(403).send({error: true, message: 'access forbiden'})
      }
      console.log("comeback after verify jwt");
      
      let query = {};
      
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      // above query will give us booking data according to user email;
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.patch("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const updateBooking = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: updateBooking.status,
        },
      };
      const result = await bookingCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("car-service is running");
});

app.listen(port, () => {
  console.log(`car service server is running on port ${port}`);
});
