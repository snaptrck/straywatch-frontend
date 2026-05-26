import { useState, useEffect, useRef } from 'react';
import { MapContainer, Marker, TileLayer, Popup } from 'react-leaflet';
import './App.css';

function App() {
  const [view, setView] = useState('reporter');
  const [dogType, setDogType] = useState('stray');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [message, setMessage] = useState('');
  const [reports, setReports] = useState([]);
  const [coords, setCoords] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const hasFetched = useRef(false);

  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [authView, setAuthView] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authRole, setAuthRole] = useState('reporter');
  const [authError, setAuthError] = useState('');

  const fetchReports = async () => {
    const response = await fetch('https://straywatch-backend.onrender.com/reports', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const data = await response.json();
    setReports(data);
  };

  useEffect(() => {
    if (token && !hasFetched.current) {
      hasFetched.current = true;
      fetchReports();
    }
  }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    const response = await fetch('https://straywatch-backend.onrender.com/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail, password: authPassword })
    });
    const data = await response.json();
    if (response.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      fetchReports();
    } else {
      setAuthError(data.error);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setAuthError('');
    const response = await fetch('https://straywatch-backend.onrender.com/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail, password: authPassword, role: authRole })
    });
    const data = await response.json();
    if (response.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      fetchReports();
    } else {
      setAuthError(data.error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setReports([]);
    hasFetched.current = false;
  };

  const getLocation = () => {
    if (!navigator.geolocation) { setMessage('GPS not supported.'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const newCoords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setCoords(newCoords);
        try {
          const geoResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newCoords.latitude}&lon=${newCoords.longitude}`);
          const geoData = await geoResponse.json();
          setLocation(geoData?.display_name || `Lat: ${newCoords.latitude.toFixed(5)}, Lng: ${newCoords.longitude.toFixed(5)}`);
        } catch {
          setLocation(`Lat: ${newCoords.latitude.toFixed(5)}, Lng: ${newCoords.longitude.toFixed(5)}`);
        }
        setGpsLoading(false);
      },
      () => { setMessage('Could not get location.'); setGpsLoading(false); },
      { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let finalLocation = location;
    if (coords && location.startsWith('Lat:')) {
      try {
        const geoResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`);
        const geoData = await geoResponse.json();
        if (geoData?.display_name) finalLocation = geoData.display_name;
      } catch {}
    }
    const formData = new FormData();
    formData.append('dogType', dogType);
    formData.append('location', finalLocation);
    formData.append('description', description);
    if (coords) { formData.append('latitude', coords.latitude); formData.append('longitude', coords.longitude); }
    if (photo) formData.append('photo', photo);

    const response = await fetch('https://straywatch-backend.onrender.com/reports', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    if (response.ok) {
      setMessage('Report submitted. Thank you!');
      setLocation('');
      setDescription('');
      setPhoto(null);
      setCoords(null);
      fetchReports();
      setTimeout(() => setMessage(''), 4000);
    } else if (response.status === 409) {
      const data = await response.json();
      const proceed = window.confirm(data.message + '\n\nClick OK to submit anyway, or Cancel to go back.');
      if (proceed) {
        const forceData = new FormData();
        forceData.append('dogType', dogType);
        forceData.append('location', finalLocation);
        forceData.append('description', description);
        if (photo) forceData.append('photo', photo);
        const forceResponse = await fetch('https://straywatch-backend.onrender.com/reports', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: forceData
        });
        if (forceResponse.ok) {
          setMessage('Report submitted. Thank you!');
          setLocation('');
          setDescription('');
          setPhoto(null);
          setCoords(null);
          fetchReports();
          setTimeout(() => setMessage(''), 4000);
        }
      }
    } else {
      setMessage('Something went wrong.');
    }
  };

  const updateStatus = async (id, newStatus) => {
    const response = await fetch(`https://straywatch-backend.onrender.com/reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus })
    });
    if (response.ok) fetchReports();
  };

  const handleFlag = async (reportId) => {
    if (!confirm('Flag this report as inappropriate or not a real dog?')) return;
    const response = await fetch(`https://straywatch-backend.onrender.com/reports/${reportId}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (response.ok) {
      setMessage('Report flagged. Thank you!');
      fetchReports();
      setTimeout(() => setMessage(''), 4000);
    } else {
      alert(data.error || 'Failed to flag report.');
    }
  };

  const typeEmoji = (type) => {
    if (type === 'injured') return '🩹';
    if (type === 'aggressive') return '⚠️';
    return '🐕';
  };

  const getBadgeClass = (type) => {
    if (type === 'injured') return 'badge-injured';
    if (type === 'aggressive') return 'badge-aggressive';
    return 'badge-stray';
  };

  const mapsLink = (report) => {
    if (report.latitude && report.longitude) return `https://www.google.com/maps?q=${report.latitude},${report.longitude}`;
    return `https://www.google.com/maps/search/${encodeURIComponent(report.location)}`;
  };

  const hasCoords = (report) => report.latitude && report.longitude;

  const ReportCard = ({ report }) => (
    <div key={report.id} className="report-card">
      <div className="card-header">
        {typeEmoji(report.dogType)}
        <span className={`dog-type-badge ${getBadgeClass(report.dogType)}`}>{report.dogType}</span>
      </div>
      {report.imageUrl && <img src={`https://straywatch-backend.onrender.com${report.imageUrl}`} alt="Dog" className="card-image" />}
      <div className="card-location">📍 {report.location} <a href={mapsLink(report)} target="_blank" rel="noreferrer" className="maps-link">🗺️ Map</a></div>
      {hasCoords(report) && (
        <div className="mini-map-container">
          <MapContainer center={[report.latitude, report.longitude]} zoom={15} className="mini-map" scrollWheelZoom={false}>
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[report.latitude, report.longitude]}>
              <Popup>{report.dogType.toUpperCase()} dog</Popup>
            </Marker>
          </MapContainer>
        </div>
      )}
      <div className="card-description">{report.description}</div>
      {report.hasDuplicates && (
        <div style={{ background: '#fef3c7', padding: '8px 12px', borderRadius: 6, marginTop: 10, fontSize: 13, color: '#92400e' }}>
          ⚠️ {report.duplicateCount} other report{report.duplicateCount > 1 ? 's' : ''} near this location.
        </div>
      )}
      <div className="card-footer">
        <span className={`status-badge status-${report.status?.toLowerCase()}`}>{report.status}</span>
        <span>{new Date(report.createdAt).toLocaleString()}</span>
      </div>
      {report.status === 'Open' && user?.role === 'responder' && (
        <div className="action-buttons">
          <button className="btn-rescue" onClick={() => updateStatus(report.id, 'Rescued')}>✅ Mark Rescued</button>
          <button className="btn-shelter" onClick={() => updateStatus(report.id, 'Sheltered')}>🏠 Send to Shelter</button>
        </div>
      )}
      {report.status !== 'Open' && user?.role === 'responder' && (
        <div className="action-buttons">
          <button className="btn-reopen" onClick={() => updateStatus(report.id, 'Open')}>🔄 Reopen</button>
        </div>
      )}
      <div style={{ marginTop: 10, textAlign: 'right' }}>
        <button onClick={() => handleFlag(report.id)} style={{ background: 'none', border: '1px solid #ddd', padding: '6px 12px', borderRadius: 6, fontSize: 12, color: '#999', cursor: 'pointer' }}>
          🚩 Flag as inappropriate
        </button>
        {report.isFlagged && <span style={{ fontSize: 11, color: '#dc2626', marginLeft: 8 }}>Flagged ({report.flagCount})</span>}
      </div>
    </div>
  );

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
        <div style={{ background: 'white', borderRadius: 16, padding: '40px 30px', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          <div style={{ textAlign: 'center', marginBottom: 30 }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🐕</div>
            <h1 style={{ fontSize: 28, color: '#ea580c', margin: 0 }}>StrayWatch PH</h1>
            <p style={{ color: '#666', marginTop: 6, fontSize: 14 }}>{authView === 'login' ? 'Welcome back! Log in to continue.' : 'Join the mission. Create an account.'}</p>
          </div>
          <div className="view-toggle" style={{ marginBottom: 24 }}>
            <button className={`toggle-btn ${authView === 'login' ? 'active' : ''}`} onClick={() => { setAuthView('login'); setAuthError(''); }} style={{ padding: '14px' }}>Login</button>
            <button className={`toggle-btn ${authView === 'signup' ? 'active' : ''}`} onClick={() => { setAuthView('signup'); setAuthError(''); }} style={{ padding: '14px' }}>Sign Up</button>
          </div>
          <form onSubmit={authView === 'login' ? handleLogin : handleSignup}>
            <div className="form-group">
              <label style={{ fontSize: 14, fontWeight: 600, color: '#444' }}>Email</label>
              <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="your@email.com" required style={{ width: '100%', padding: 14, border: '1px solid #ddd', borderRadius: 10, fontSize: 15, fontFamily: 'inherit' }} />
            </div>
            <div className="form-group">
              <label style={{ fontSize: 14, fontWeight: 600, color: '#444' }}>Password</label>
              <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Min 6 characters" required style={{ width: '100%', padding: 14, border: '1px solid #ddd', borderRadius: 10, fontSize: 15, fontFamily: 'inherit' }} />
            </div>
            {authView === 'signup' && (
              <div className="form-group">
                <label style={{ fontSize: 14, fontWeight: 600, color: '#444' }}>I am a...</label>
                <select value={authRole} onChange={(e) => setAuthRole(e.target.value)} style={{ width: '100%', padding: 14, border: '1px solid #ddd', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', background: 'white' }}>
                  <option value="reporter">🐕 Reporter — I want to report stray dogs</option>
                  <option value="responder">🏥 Responder — I'm a vet, rescuer, or shelter</option>
                </select>
              </div>
            )}
            {authError && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px 14px', borderRadius: 10, marginBottom: 16, fontSize: 14, textAlign: 'center' }}>{authError}</div>}
            <button type="submit" style={{ width: '100%', padding: 16, background: '#ea580c', color: 'white', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>{authView === 'login' ? '🔐 Login' : '✨ Create Account'}</button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 20, color: '#999', fontSize: 12 }}>By continuing, you agree to help stray dogs 🐾</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><h1>🐕 StrayWatch PH</h1><p>Report stray dogs. Help rescuers find them.</p></div>
          <button onClick={handleLogout} className="btn-logout">Logout</button>
        </div>
      </header>
      <div className="view-toggle">
        <button className={`toggle-btn ${view === 'reporter' ? 'active' : ''}`} onClick={() => setView('reporter')}>📋 Report</button>
        <button className={`toggle-btn ${view === 'responder' ? 'active' : ''}`} onClick={() => setView('responder')}>🏥 Respond</button>
      </div>

      {view === 'reporter' && (
        <div className="form-card">
          <h2>📋 Report a Dog</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group"><label>Dog Type</label><select value={dogType} onChange={(e) => setDogType(e.target.value)}><option value="stray">🐕 Stray</option><option value="injured">🩹 Injured</option><option value="aggressive">⚠️ Aggressive</option></select></div>
            <div className="form-group"><label>Location</label><div style={{ display: 'flex', gap: 8 }}><input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where?" required style={{ flex: 1 }} /><button type="button" onClick={getLocation} className="btn-gps" disabled={gpsLoading}>{gpsLoading ? '...' : '📍 GPS'}</button></div></div>
            <div className="form-group"><label>Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe..." required rows={4} /></div>
            <div className="form-group"><label>Photo</label><input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])}  /></div>
            <button type="submit" className="btn-submit">Submit Report</button>
          </form>
          {message && <div className="success-message">{message}</div>}
        </div>
      )}

      {view === 'responder' && (
        <div className="reports-section">
          <h2>All Reports <span className="count">{reports.length}</span></h2>
          {reports.length === 0 ? <div className="empty-state"><div className="icon">🐾</div><p>No reports yet.</p></div> : reports.map(report => <ReportCard key={report.id} report={report} />)}
        </div>
      )}

      {view === 'reporter' && (
        <div className="reports-section" style={{ marginTop: 24 }}>
          <h2>Recent Reports <span className="count">{reports.length}</span></h2>
          {reports.length === 0 ? <div className="empty-state"><div className="icon">🐾</div><p>No reports yet.</p></div> : reports.slice(0, 5).map(report => <ReportCard key={report.id} report={report} />)}
        </div>
      )}
    </div>
  );
}

export default App;