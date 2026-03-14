const bcrypt = require('bcrypt');
const prisma = require('./client');

async function main() {
  console.log('Seeding sample data...');

  // Create admin user (idempotent)
  const adminEmail = 'admin@example.com';
  const adminPassword = 'password123';
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    const hash = await bcrypt.hash(adminPassword, 10);
    admin = await prisma.user.create({ data: { name: 'Admin User', email: adminEmail, passwordHash: hash, role: 'ADMIN' } });
    console.log('Created admin:', adminEmail);
  } else {
    console.log('Admin already exists:', adminEmail);
  }

  // Create a second admin for the real account (if useful)
  const realAdminEmail = 'priyanshu@stationery.com';
  const realAdminPassword = 'password123';
  let realAdmin = await prisma.user.findUnique({ where: { email: realAdminEmail } });
  if (!realAdmin) {
    const hash = await bcrypt.hash(realAdminPassword, 10);
    realAdmin = await prisma.user.create({ data: { name: 'Priyanshu Kumar Gupta', email: realAdminEmail, passwordHash: hash, role: 'ADMIN' } });
    console.log('Created real admin:', realAdminEmail);
  } else {
    console.log('Real admin already exists:', realAdminEmail);
  }

  // Create a customer user
  const customerEmail = 'customer@example.com';
  const customerPassword = 'password123';
  let customer = await prisma.user.findUnique({ where: { email: customerEmail } });
  if (!customer) {
    const hash = await bcrypt.hash(customerPassword, 10);
    customer = await prisma.user.create({ data: { name: 'John Customer', email: customerEmail, passwordHash: hash, role: 'CUSTOMER' } });
    console.log('Created customer:', customerEmail);
  } else {
    console.log('Customer already exists:', customerEmail);
  }

  // Create sample products (idempotent using uid)
  const productsData = [
    {
      uid: 'sample-notebook',
      name: 'A4 Lined Notebook',
      description: '200-page lined notebook, perfect for notes',
      category: 'STATIONERY',
      subCategory: 'Notebook',
      costPrice: 30.0,
      baseSellingPrice: 50.0,
      totalStock: 100,
      images: [{ url: 'https://via.placeholder.com/150', altText: 'Notebook' }]
    },
    {
      uid: 'sample-pen',
      name: 'Blue Ballpoint Pen Pack',
      description: 'Pack of 10 smooth-writing pens',
      category: 'STATIONERY',
      subCategory: 'Pen',
      costPrice: 20.0,
      baseSellingPrice: 40.0,
      totalStock: 200,
      images: [{ url: 'https://via.placeholder.com/150', altText: 'Pen' }]
    },
    {
      uid: 'sample-eraser',
      name: 'Rubber Eraser',
      description: 'Soft rubber eraser',
      category: 'STATIONERY',
      subCategory: 'Eraser',
      costPrice: 5.0,
      baseSellingPrice: 12.0,
      totalStock: 300,
      images: [{ url: 'https://via.placeholder.com/150', altText: 'Eraser' }]
    }
  ];

  const createdProducts = [];
  for (const p of productsData) {
    // Find by name to be compatible with current Prisma client/version
    // Ensure created products are linked to the real admin user
    let prod = await prisma.product.findUnique({ where: { uid: p.uid } });

    if (!prod) {
      prod = await prisma.product.create({
        data: {
          uid: p.uid,
          name: p.name,
          description: p.description,
          category: p.category,
          subCategory: p.subCategory,
          costPrice: p.costPrice,
          baseSellingPrice: p.baseSellingPrice,
          bargainable: true,
          totalStock: p.totalStock,
          lowStockThreshold: p.lowStockThreshold || 10,
          isActive: true,
          createdById: realAdmin.id,
          images: { create: p.images }
        },
        include: { images: true }
      });
      console.log('Created product:', p.name);
    } else {
      // Ensure the product is attributed to the real admin for reporting
      if (!prod.createdById) {
        prod = await prisma.product.update({
          where: { id: prod.id },
          data: { createdById: realAdmin.id }
        });
        console.log('Updated product owner for:', p.name);
      }
      console.log('Product exists:', p.name);
    }
    createdProducts.push(prod);
  }

  // Create sample SELF order (placed by admin) if not exists
  const existingSelf = await prisma.order.findFirst({ where: { type: 'SELF', recipientName: 'Admin Office' } });
  if (!existingSelf) {
    const items = [
      { productId: createdProducts[0].id, quantity: 2, sp: createdProducts[0].baseSellingPrice, cp: createdProducts[0].costPrice },
      { productId: createdProducts[1].id, quantity: 1, sp: createdProducts[1].baseSellingPrice, cp: createdProducts[1].costPrice }
    ];

    const tx = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({ data: { type: 'SELF', status: 'PENDING', recipientName: 'Admin Office', placedById: admin.id, adminId: admin.id } });

      let totalSp = 0;
      let totalCp = 0;
      for (const it of items) {
        const product = await tx.product.findUnique({ where: { id: it.productId }, include: { images: true } });
        const subtotalSp = it.sp * it.quantity;
        const subtotalCp = it.cp * it.quantity;
        totalSp += subtotalSp;
        totalCp += subtotalCp;

        await tx.orderItem.create({ data: { orderId: order.id, productId: product.id, productName: product.name, productPhoto: product.images[0]?.url || null, quantity: it.quantity, cp: it.cp, sp: it.sp, subtotalSp, subtotalCp } });
      }

      await tx.order.update({ where: { id: order.id }, data: { totalSp, totalCp } });

      return order;
    });

    console.log('Created SELF order id:', tx.id);
  } else {
    console.log('SELF order already exists');
  }

  // Create sample CUSTOMER order (placed by customer)
  const existingCustomerOrder = await prisma.order.findFirst({ where: { type: 'CUSTOMER', recipientName: 'John Customer' } });
  if (!existingCustomerOrder) {
    const items = [
      { productId: createdProducts[2].id, quantity: 3, sp: createdProducts[2].baseSellingPrice, cp: createdProducts[2].costPrice }
    ];

    const tx2 = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({ data: { type: 'CUSTOMER', status: 'PENDING', recipientName: 'John Customer', placedById: customer.id } });

      let totalSp = 0;
      let totalCp = 0;
      for (const it of items) {
        const product = await tx.product.findUnique({ where: { id: it.productId }, include: { images: true } });
        const subtotalSp = it.sp * it.quantity;
        const subtotalCp = it.cp * it.quantity;
        totalSp += subtotalSp;
        totalCp += subtotalCp;

        await tx.orderItem.create({ data: { orderId: order.id, productId: product.id, productName: product.name, productPhoto: product.images[0]?.url || null, quantity: it.quantity, cp: it.cp, sp: it.sp, subtotalSp, subtotalCp } });

        // decrement stock
        await tx.product.update({ where: { id: product.id }, data: { totalStock: { decrement: it.quantity }, totalSold: { increment: it.quantity } } });
      }

      await tx.order.update({ where: { id: order.id }, data: { totalSp, totalCp } });

      return order;
    });

    console.log('Created CUSTOMER order id:', tx2.id);
  } else {
    console.log('Customer order already exists');
  }

  console.log('Seeding complete. Admin login: admin@example.com / password123');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
