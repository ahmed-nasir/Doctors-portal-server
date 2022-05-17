const express = require('express');
const cors = require('cors');
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express()
const port = process.env.PPRT || 5000

//MEDDLE WARE
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.imkca.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {

    try {
        await client.connect();
        const serviceCollection = client.db('doctors_portal').collection('services')
        const bookingCollection = client.db('doctors_portal').collection('bookings')

        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);

        })

        app.get('/available', async (req, res) => {
            const date = req.query.date || 'May 18, 2022';

            //step 1: get all services
            const services = await serviceCollection.find().toArray();

            //step 2: get the booking of that day
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();

            //step 3: for each service, find bookins for that service 
            services.forEach(service=>{
                const serviceBookings = bookings.filter(b=>b.treatment === service.name);
                const booked = serviceBookings.map(s=>s.slot);
                const available = service.slots.filter(s=>!booked.includes(s))
                service.available =available;
            })

            res.send(services);

            /**
             * API Naming Convention 
             * app.get('/booking) // get all bookings in this collection of get more then one or by filter
             * app.get('/booking/:id) // get a specific booking 
             * app.post('/booking) // add a new booking
             * app.patch('/booking/:id) // update a booking items
             * app.delete('/booking/:id') //
            */

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