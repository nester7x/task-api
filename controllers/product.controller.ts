import type { Request, Response } from 'express';
import Product from '../models/product.model';

export const getProducts = async (req: Request, res: Response) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

export const getProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    res.status(200).json(product);
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    const product = await Product.create(req.body);
    res.status(200).json(product);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create product' });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const product = await Product.findByIdAndUpdate(id, req.body);

    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    const updatedProduct = await Product.findById(id);
    res.status(200).json(updatedProduct);
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
};