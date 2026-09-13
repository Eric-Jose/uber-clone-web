import React, { useEffect, useState } from 'react';
import { BACKEND_URL } from '../config';
import '../styles/FavoriteDrivers.css';

function FavoriteDrivers({ onSelectDriver }) {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('token');

    if (!token) {
      setLoading(false);
      return undefined;
    }

    const loadFavorites = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/drivers/favorites`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar seus motoristas favoritos.');
        if (!cancelled) setFavorites(Array.isArray(data.drivers) ? data.drivers : []);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Não foi possível carregar seus motoristas favoritos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadFavorites();
    return () => { cancelled = true; };
  }, []);

  const handleSelectFavorite = (driver) => {
    onSelectDriver?.(driver);
  };

  const handleRemoveFavorite = async (driverId) => {
    const token = localStorage.getItem('token');
    if (!driverId || !token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/drivers/favorites/${encodeURIComponent(driverId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível remover este motorista.');
      setFavorites((current) => current.filter((driver) => driver.uid !== driverId));
    } catch (removeError) {
      setError(removeError.message || 'Não foi possível remover este motorista.');
    }
  };

  return (
    <div className="favorites-container">
      <h2>⭐ Motoristas Favoritos</h2>
      <p className="subtitle">Seus motoristas salvos</p>

      {error && <div className="empty-state" role="alert"><p>{error}</p></div>}
      {loading ? (
        <div className="empty-state"><p>Carregando seus motoristas favoritos...</p></div>
      ) : (
        <div className="drivers-grid">
          {favorites.length > 0 ? (
            favorites.map((driver) => {
              const vehicle = [driver.vehicle?.model, driver.vehicle?.color].filter(Boolean).join(' ');
              const rating = Number(driver.rating);
              return (
                <div key={driver.uid} className="driver-card">
                  <div className="driver-header">
                    <div className="driver-avatar">🚗</div>
                    <div className="driver-info">
                      <h3>{driver.name}</h3>
                      <div className="driver-stats">
                        {Number.isFinite(rating) && rating > 0 && <span className="rating">⭐ {rating.toFixed(1)}</span>}
                        {Number(driver.totalRides) > 0 && <span className="rides">🚗 {driver.totalRides}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="driver-details">
                    {vehicle && <p className="car-info">🚙 {vehicle}</p>}
                    {driver.vehicle?.year && <p className="response">Ano do veículo: {driver.vehicle.year}</p>}
                  </div>

                  <div className="driver-actions">
                    <button type="button" className="btn-select" onClick={() => handleSelectFavorite(driver)}>
                      ✓ Solicitar
                    </button>
                    <button type="button" className="btn-remove" onClick={() => handleRemoveFavorite(driver.uid)} aria-label={`Remover ${driver.name} dos favoritos`}>
                      ✕
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-state">
              <p>Você ainda não tem motoristas favoritos</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FavoriteDrivers;
