import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: String,
  stock: { type: Number, default: 0 },
  views: Number,
  orders: Number,
  price: Number,
  rating: Number
}, { _id: false });

const sellerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contactName: String,
  category: String,
  location: String,
  demo: Boolean,
  metrics: {
    previous: { visits: Number, orders: Number, revenue: Number, inStockPct: Number, cancellationPct: Number, rating: Number, returnPct: Number },
    current: { visits: Number, orders: Number, revenue: Number, inStockPct: Number, cancellationPct: Number, rating: Number, returnPct: Number }
  },
  products: [productSchema]
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const conversationSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", required: true },
  status: { type: String, enum: ["active", "closed"], default: "active" },
  messages: [messageSchema]
}, { timestamps: true });

const commitmentSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", required: true },
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
  action: { type: String, required: true, maxlength: 180 },
  dueDate: { type: Date, required: true },
  followUpAt: { type: Date, required: true },
  lastFollowUpAt: Date,
  owner: { type: String, default: "Seller" },
  status: { type: String, enum: ["open", "completed", "blocked"], default: "open" },
  sellerNote: { type: String, maxlength: 500 },
  confirmedBySeller: { type: Boolean, default: false }
}, { timestamps: true });

// Explicit types prevent incompatible overloads between cached and new Mongoose models.
type Seller = mongoose.InferSchemaType<typeof sellerSchema>;
type Conversation = mongoose.InferSchemaType<typeof conversationSchema>;
type Commitment = mongoose.InferSchemaType<typeof commitmentSchema>;

export const SellerModel: mongoose.Model<Seller> =
  (mongoose.models.Seller as mongoose.Model<Seller> | undefined) ??
  mongoose.model<Seller>("Seller", sellerSchema);

export const ConversationModel: mongoose.Model<Conversation> =
  (mongoose.models.Conversation as mongoose.Model<Conversation> | undefined) ??
  mongoose.model<Conversation>("Conversation", conversationSchema);

export const CommitmentModel: mongoose.Model<Commitment> =
  (mongoose.models.Commitment as mongoose.Model<Commitment> | undefined) ??
  mongoose.model<Commitment>("Commitment", commitmentSchema);
