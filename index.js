const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express()
const port = process.env.PPRT || 5000

//MEDDLE WARE
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.imkca.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    // console.log('verifyJWT working');
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized Access!' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {

    try {
        console.log("databage connected")
        await client.connect();
        const serviceCollection = client.db('doctors_portal').collection('services');
        const bookingCollection = client.db('doctors_portal').collection('bookings');
        const userCollection = client.db('doctors_portal').collection('users');

        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        })

        app.get('/user',async(req,res)=>{
            const users = await userCollection.find().toArray();
            res.send(users)
        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };

            const result = await userCollection.updateOne(filter, updateDoc, options);
            //JWT
            // const token=jwt.sign({Payload }, privateKey, { Options: expire hobe kokhon});
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ result, token });
        })

        app.get('/available', async (req, res) => {
            const date = req.query.date;

            //step 1: get all services
            const services = await serviceCollection.find().toArray();

            //step 2: get the booking of that day
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();

            //step 3: for each service, find bookins for that service 
            services.forEach(service => {
                //step 4: find bookings for that service
                const serviceBookings = bookings.filter(book => book.treatment === service.name);
                //step 5: select slots for the service Bookings
                const bookedSlots = serviceBookings.map(book => book.slot);
                //step 6: select those slots that are not in bookSlots
                const available = service.slots.filter(slot => !bookedSlots.includes(slot))
                //step 7: set available to slots to make it easier
                service.slots = available;
            });

            res.send(services);

            /**
             * API Naming Convention 
             * app.get('/booking) // get all bookings in this collection of get more then one or by filter
             * app.get('/booking/:id) // get a specific booking 
             * app.post('/booking) // add a new booking
             * app.patch('/booking/:id) // update a booking items
             * app.put('/booking/:id) // upsert => update(if exists) or insert(if doesn't exist)
             * app.delete('/booking/:id') //
            */

        })

        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query.patient;

            const decodedEmail = req.decoded.email;

            if (patient === decodedEmail) {
                const query = { patient: patient };
                const bookings = await bookingCollection.find(query).toArray();
                res.send(bookings);
            } else {
                return res.status(403).send({ message: 'forbidden access' });
            }
        })



        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result });
        })
    }
    finally {

    }

}
run().catch(console.dir);

//APIS
app.get('/', (req, res) => {
    res.send('Hello from Doctors portal!')
})

app.listen(port, () => {
    console.log(`Doctors App listening on port ${port}`)
})