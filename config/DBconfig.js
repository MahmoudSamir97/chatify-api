const mongoose = require('mongoose');

const connectToMongoDB = async () => {
  try {
    const DB = process.env.DATABASE_URL;
    await mongoose.connect(DB);
    console.log('Connected to the database successfully 😎');
  } catch (error) {
    console.log('Error connecting to the database', error.message);
  }
};

module.exports = connectToMongoDB;
