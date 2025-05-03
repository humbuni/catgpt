import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

function SubmitExpense({ onAddExpense }) {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [lastId, setLastId] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!desc || !amount) return;
    const id = Math.round(10000000*Math.random());
    onAddExpense({ id, desc, amount: parseFloat(amount), date: new Date().toLocaleString() });
    setDesc('');
    setAmount('');
    setLastId(id);
  };

  return (
    <div className="container mt-4">
      <h2>Submit Expense</h2>
      <p className="text-muted">Fill out the form below to submit a new expense. All fields are required.</p>
      {lastId && (
        <div className="alert alert-success" role="alert">
          Expense submitted! Expense ID: <strong>{lastId}</strong>
        </div>
      )}
      <form onSubmit={handleSubmit} className="mb-3">
        <div className="mb-3">
          <label className="form-label">Description</label>
          <input className="form-control" value={desc} onChange={e => setDesc(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="form-label">Amount</label>
          <input type="number" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit">Submit</button>
      </form>
    </div>
  );
}

function ViewExpenses({ expenses }) {
  return (
    <div className="container mt-4">
      <h2>Submitted Expenses</h2>
      {expenses.length === 0 ? (
        <p>No expenses submitted yet.</p>
      ) : (
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Description</th>
              <th>Amount</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp, idx) => (
              <tr key={idx}>
                <td>{exp.desc}</td>
                <td>${exp.amount.toFixed(2)}</td>
                <td>{exp.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function App() {
  const [view, setView] = useState('submit');
  const [expenses, setExpenses] = useState([]);

  const handleAddExpense = (expense) => {
    setExpenses([expense, ...expenses]);
  };

  return (
    <div>
      <nav className="navbar navbar-expand navbar-dark bg-dark">
        <div className="container-fluid">
          <span className="navbar-brand">fakes-expenses</span>
          <div className="navbar-nav">
            <button className={`nav-link btn btn-link${view === 'submit' ? ' active' : ''}`} onClick={() => setView('submit')}>Submit Expense</button>
            <button className={`nav-link btn btn-link${view === 'view' ? ' active' : ''}`} onClick={() => setView('view')}>View Expenses</button>
          </div>
        </div>
      </nav>
      {view === 'submit' ? (
        <SubmitExpense onAddExpense={handleAddExpense} />
      ) : (
        <ViewExpenses expenses={expenses} />
      )}
    </div>
  );
}

export default App;
