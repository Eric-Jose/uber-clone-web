// src/config/database.js
const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = String(process.env.MONGODB_URI || '').trim();

  if (!uri) {
    console.error('❌ MONGODB_URI não configurada. Configure a variável de ambiente do banco no Railway.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10
    });

    console.log(`✅ MongoDB Conectado: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ Erro ao conectar MongoDB:', error.message);
    if (error?.name) console.error('MongoDB erro:', error.name);
    process.exit(1);
  }
};

module.exports = connectDB;
