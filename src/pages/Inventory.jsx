import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { formatRupiah } from '../utils/formatCurrency'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'

async function fetchProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

async function upsertProduct(product) {
  const { data, error } = await supabase
    .from('products')
    .upsert(product)
    .select()
    .single()
  if (error) throw error
  return data
}

async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

const emptyForm = { barcode: '', name: '', price_sell: '', stock: '' }

function ProductForm({ initialData, onSubmit, isPending, onCancel }) {
  const [form, setForm] = useState(initialData || emptyForm)

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      ...form,
      price_sell: parseInt(form.price_sell),
      stock: parseInt(form.stock),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        label="Barcode"
        name="barcode"
        value={form.barcode}
        onChange={handleChange}
        required
        placeholder="Contoh: 8991234567890"
      />
      <Input
        label="Nama Produk"
        name="name"
        value={form.name}
        onChange={handleChange}
        required
        placeholder="Contoh: Aqua 600ml"
      />
      <Input
        label="Harga Jual (Rp)"
        name="price_sell"
        type="number"
        value={form.price_sell}
        onChange={handleChange}
        required
        placeholder="Contoh: 5000"
      />
      <Input
        label="Stok"
        name="stock"
        type="number"
        value={form.stock}
        onChange={handleChange}
        required
        placeholder="Contoh: 100"
      />
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" variant="primary" className="flex-1" disabled={isPending}>
          {isPending ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </div>
    </form>
  )
}

function Inventory() {
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })

  const upsertMutation = useMutation({
    mutationFn: upsertProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setShowModal(false)
      setEditingProduct(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  })

  const handleEdit = (product) => {
    setEditingProduct(product)
    setShowModal(true)
  }

  const handleAdd = () => {
    setEditingProduct(null)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingProduct(null)
  }

  const handleDelete = (product) => {
    if (window.confirm(`Hapus produk "${product.name}"?`)) {
      deleteMutation.mutate(product.id)
    }
  }

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search)
  )

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manajemen Inventori</h1>
            <p className="text-sm text-gray-500 mt-1">{products.length} produk terdaftar</p>
          </div>
          <Button variant="primary" onClick={handleAdd}>
            + Tambah Produk
          </Button>
        </div>

        <div className="mb-4">
          <Input
            placeholder="Cari nama produk atau barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm"
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p>Tidak ada produk ditemukan</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Produk
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Barcode
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Harga Jual
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Stok
                  </th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{product.name}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-500 font-mono">{product.barcode}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatRupiah(product.price_sell)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`text-sm font-semibold ${
                          product.stock <= 5 ? 'text-red-600' : 'text-gray-900'
                        }`}
                      >
                        {product.stock}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          className="text-sm py-1 px-3"
                          onClick={() => handleEdit(product)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          className="text-sm py-1 px-3"
                          onClick={() => handleDelete(product)}
                          disabled={deleteMutation.isPending}
                        >
                          Hapus
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
      >
        <ProductForm
          initialData={editingProduct}
          onSubmit={(data) => upsertMutation.mutate(data)}
          isPending={upsertMutation.isPending}
          onCancel={handleCloseModal}
        />
        {upsertMutation.isError && (
          <p className="text-sm text-red-600 mt-2">
            Gagal menyimpan. Periksa apakah barcode sudah digunakan.
          </p>
        )}
      </Modal>
    </div>
  )
}

export default Inventory
