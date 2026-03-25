import './TopProductsTable.css';

const mockProducts = [
  { id: '1', name: 'Wireless Ergonomic Keyboard', category: 'Electronics', sales: 342, revenue: 30780, stock: 'In Stock' },
  { id: '2', name: 'Noise-Cancelling Headphones', category: 'Audio', sales: 256, revenue: 51200, stock: 'Low Stock' },
  { id: '3', name: 'Minimalist Desk Lamp', category: 'Home', sales: 189, revenue: 6615, stock: 'In Stock' },
  { id: '4', name: 'Standing Desk Converter', category: 'Office', sales: 124, revenue: 24676, stock: 'Out of Stock' },
];

export default function TopProductsTable() {
  return (
    <div className="top-products-container glass-panel">
      <div className="table-header">
        <h3>Top Selling Products</h3>
        <button className="btn-secondary">View All</button>
      </div>
      <div className="table-responsive">
        <table className="modern-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Category</th>
              <th>Units Sold</th>
              <th>Revenue</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {mockProducts.map((product) => (
              <tr key={product.id}>
                <td className="product-name">{product.name}</td>
                <td className="product-category">{product.category}</td>
                <td>{product.sales}</td>
                <td className="product-revenue">${product.revenue.toLocaleString()}</td>
                <td>
                  <span className={`status-badge ${
                    product.stock === 'In Stock' ? 'status-success' : 
                    product.stock === 'Low Stock' ? 'status-warning' : 'status-danger'
                  }`}>
                    {product.stock}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
