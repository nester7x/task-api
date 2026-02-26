import mongoose, { Schema } from 'mongoose';

export interface IProduct {
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required']
    },
    quantity: {
      type: Number,
      required: [true, 'Product quantity is required'],
      default: 0
    },
    price: {
      type: Number,
      required: [true, 'Product price is required']
    },
    image: {
      type: String,
      required: false
    }
  },
  { timestamps: true }
);

export default mongoose.model<IProduct>('Product', ProductSchema);