var app = require('express')();
const mongoose = require('mongoose');
var express = require('express');
var path = require('path');
var http = require('http').Server(app);
var validator = require('express-validator');

// import controller
var AuthController = require('./controllers/AuthController');

// import Router file
var pageRouter = require('./routers/route');

// Connect to MongoDB
// mongodb://localhost:27017
mongoose.connect('mongodb://localhost:27017/business_rules_db', { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
}).then(() => console.log('MongoDB connected...'))
.catch(err => console.log(err));

var session = require('express-session');
var bodyParser = require('body-parser');
var flash = require('connect-flash');
var i18n = require("i18n-express");
app.use(bodyParser.json());
var urlencodeParser = bodyParser.urlencoded({ extended: true });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { message: 'Something went wrong!' });
});

app.use(session({
  key: 'user_sid',
  secret: 'somerandonstuffs',
  resave: false,
  saveUninitialized: false,
  cookie: {
    expires: 1200000
  }
}));

app.use(session({ resave: false, saveUninitialized: true, secret: 'nodedemo' }));
app.use(flash());
app.use(i18n({
  translationsPath: path.join(__dirname, 'i18n'), // <--- use here. Specify translations files path.
  siteLangs: ["es", "en", "de", "ru", "it", "fr"],
  textsVarName: 'translation'
}));

app.use('/public', express.static('public'));

app.get('/layouts/', function (req, res) {
  res.render('view');
});

// apply controller
AuthController(app);

// Mock customer data
let customers = [
  {
    id: 1,
    name: 'Carolyn Harvey',
    email: 'CarolynHarvey@rhyta.com',
    phone: '580-464-4694',
    balance: 3245,
    joiningDate: '06 Apr, 2020'
  },
  {
    id: 2,
    name: 'Angie Andres',
    email: 'AngieAndres@armyspy.com',
    phone: '213-494-4527',
    balance: 3245,
    joiningDate: '28 Apr, 2020'
  },
  // Add more customers as needed
];

// Get all customers
app.get('/api/customers', (req, res) => {
  res.json(customers);
});

// Add a new customer
app.post('/api/customers', (req, res) => {
  const newCustomer = {
    id: customers.length + 1,
    ...req.body
  };
  customers.push(newCustomer);
  res.json(newCustomer);
});

// Update a customer
app.put('/api/customers/:id', (req, res) => {
  const { id } = req.params;
  const customerIndex = customers.findIndex(c => c.id === parseInt(id));
  if (customerIndex !== -1) {
    customers[customerIndex] = { id: parseInt(id), ...req.body };
    res.json(customers[customerIndex]);
  } else {
    res.status(404).send('Customer not found');
  }
});

// Delete a customer
app.delete('/api/customers/:id', (req, res) => {
  const { id } = req.params;
  const customerIndex = customers.findIndex(c => c.id === parseInt(id));
  if (customerIndex !== -1) {
    customers = customers.filter(c => c.id !== parseInt(id));
    res.json({ message: 'Customer deleted' });
  } else {
    res.status(404).send('Customer not found');
  }
});


//For set layouts of html view
var expressLayouts = require('express-ejs-layouts');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);

// Define All Route 
pageRouter(app);

app.get('/', function (req, res) {
  res.redirect('/');
});

http.listen(80, function () {
  console.log('listening on *:80');
});
