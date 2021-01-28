'use strict';

const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();
const routes = require('./clova');

const PORT = process.env.PORT || 8000;

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));
app.use((err, req, res, next) => next());

app.use('/', routes);

app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});

app.listen(PORT, () => {
    console.log(`Server is running on ${PORT} port`);
});
