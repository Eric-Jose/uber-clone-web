import React, { useState } from 'react';
import '../styles/Ratings.css';

function Ratings({ rideId, onRatingSubmit }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitRating = (e) => {
    e.preventDefault();
    if (rating === 0) {
      alert('Por favor, selecione uma classificação!');
      return;
    }

    const ratingData = {
      rideId,
      rating,
      comment,
      timestamp: new Date()
    };

    onRatingSubmit(ratingData);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="rating-container success">
        <div className="success-message">
          <span className="success-icon">✅</span>
          <h3>Obrigado pela avaliação!</h3>
          <p>Sua opinião nos ajuda a melhorar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rating-container">
      <h2>⭐ Avalie sua experiência</h2>
      <p>Como foi a sua corrida?</p>

      <form onSubmit={handleSubmitRating} className="rating-form">
        {/* Estrelas */}
        <div className="stars-container">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              className={`star ${star <= (hoverRating || rating) ? 'active' : ''}`}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
            >
              ⭐
            </button>
          ))}
        </div>

        {/* Descrição da nota */}
        <div className="rating-description">
          {rating === 5 && <p>Excelente! 🎉</p>}
          {rating === 4 && <p>Muito Bom! 😊</p>}
          {rating === 3 && <p>Bom! 👍</p>}
          {rating === 2 && <p>Pode melhorar 😕</p>}
          {rating === 1 && <p>Ruim 😞</p>}
        </div>

        {/* Comentário */}
        <textarea
          placeholder="Deixe um comentário (opcional)..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows="4"
        />

        <button type="submit" className="btn-submit">
          📤 Enviar Avaliação
        </button>
      </form>
    </div>
  );
}

export default Ratings;
