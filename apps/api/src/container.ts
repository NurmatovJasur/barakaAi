import { prisma } from './config/prisma';
import { OfferRepository } from './repositories/offer.repository';
import { AuthService } from './services/auth.service';
import { BasketService } from './services/basket.service';
import { DashboardService } from './services/dashboard.service';
import { OptimizerService } from './services/optimizer.service';
import { PriceIntelligenceService } from './services/priceIntelligence.service';
import { ProductService } from './services/product.service';
import { PurchaseService } from './services/purchase.service';
import { SupplierOfferService } from './services/supplierOffer.service';
import { SupplierService } from './services/supplier.service';
import { RuleBasedAssistant } from './services/assistant/ruleBasedAssistant';
import type { ProcurementAssistantService } from './services/assistant/assistant.types';

const offerRepo = new OfferRepository(prisma);
const products = new ProductService(prisma);
const prices = new PriceIntelligenceService(prisma);
const optimizer = new OptimizerService(prisma, offerRepo);

export const services = {
  auth: new AuthService(prisma),
  products,
  offers: new SupplierOfferService(prisma, offerRepo),
  suppliers: new SupplierService(prisma),
  basket: new BasketService(prisma, products),
  optimizer,
  purchases: new PurchaseService(prisma),
  prices,
  dashboard: new DashboardService(prisma, prices),
  assistant: new RuleBasedAssistant(prisma, optimizer, prices) as ProcurementAssistantService,
};
