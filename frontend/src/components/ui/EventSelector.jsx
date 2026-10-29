import React from 'react';
import styles from './EventSelector.module.css';

const EventSelector = ({ events = [], selectedEventId = '', onSelect }) => {
  const handleChange = (e) => {
    const id = e.target.value;
    onSelect(id);
  };

  return (
    <div className={styles.eventSelectorContainer}>
      <div className={styles.eventSelectorHeader}>
        <div>
          <p className={styles.eventLabel}>Event</p>
          <p className={styles.eventHint}>Switch to another live event</p>
        </div>
        <span className={styles.eventBadge}>Live</span>
      </div>
      <div className={styles.selectWrapper}>
        <select
          value={selectedEventId}
          onChange={handleChange}
          className={styles.eventSelect}
        >
          <option value="" disabled>Choose an event</option>
          {(Array.isArray(events) ? events : []).map((event) => (
            <option key={event._id || event.id} value={event._id || event.id}>
              {event.name || event.title || 'Untitled Event'}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default EventSelector;
