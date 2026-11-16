const { Schema, Types, model } = require('mongoose');

const messageSchema = new Schema(
  {
    sender: {
      type: Types.ObjectId,
      ref: 'User',
    },
    content: {
      type: String,
      trim: true,
    },
    chat: {
      type: Types.ObjectId,
      ref: 'Chat',
    },
  },
  { timestamps: true },
);

// Messages are always loaded per chat in chronological order
messageSchema.index({ chat: 1, createdAt: 1 });

const Message = model('Message', messageSchema);

module.exports = Message;
