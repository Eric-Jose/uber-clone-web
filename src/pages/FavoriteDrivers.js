import React, { useState, useEffect } from 'react';
import '../styles/FavoriteDrivers.css';

function FavoriteDrivers({ userId, onSelectDriver }) {
  const [favorites, setFavorites] = useState([
    {
      id: 1,
      name: 'Carlos Silva',
      rating: 4.9,
      car: 'Honda Civic Preto',
      rides: 1250,
      image: '👨‍🦰',
      responseTime: '2 min'
    },
    {
      id: 2,
      name: 'Maria Santos',
      rating: 4.8,
      car: 'Toyota Corolla Branco',
      rides: 850,
      image: '👩‍🦰',
      responseTime: '3 min'
    }
  ]);

  const handleSelectFavorite = (driver) => {
    onSelectDriver(driver);
  };

  const handleRemoveFavorite = (id) => {
    setFavorites(favorites.filter(f => f.id !== id));
  };

  return (
    <div className="favorites-container">
      <h2>⭐ Motoristas Favoritos</h2>
      <p className="subtitle">Seus motoristas mais confiáveis</p>

      <div className="drivers-grid">
        {favorites.length > 0 ? (
          favorites.map(driver => (
            <div key={driver.id} className="driver-card">
              <div className="driver-header">
                <div className="driver-avatar">{driver.image}</div>
                <div className="driver-info">
                  <h3>{driver.name}</h3>
                  <div className="driver-stats">
                    <span className="rating">⭐ {driver.rating}</span>
                    <span className="rides">🚗 {driver.rides}</span>
                  </div>
                </div>
              </div>

              <div className="driver-details">
                <p className="car-info">🚙 {driver.car}</p>
                <p className="response">⏱️ Tempo de resposta: {driver.responseTime}</p>
              </div>

              <div className="driver-actions">
                <button
                  className="btn-select"
                  onClick={() => handleSelectFavorite(driver)}
                >
                  ✓ Solicitar
                </button>
                <button
                  className="btn-remove"
                  onClick={() => handleRemoveFavorite(driver.id)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>Você ainda não tem motoristas favoritos</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default FavoriteDrivers;
