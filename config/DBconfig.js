const mongoose = require('mongoose');

const connectToMongoDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('Connected to the database successfully 😎');
  } catch (error) {
    // The API is useless without a database, so fail fast and let the platform restart us
    console.error('Error connecting to the database', error.message);
    process.exit(1);
  }
};

module.exports = connectToMongoDB;
