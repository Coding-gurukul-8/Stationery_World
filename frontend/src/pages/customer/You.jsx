import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { authUtils } from '../../utils/auth';
import { Edit2, Camera, Save, X } from 'lucide-react';
import './You.css';
import { API_BASE_URL } from '../../config/constants';

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Ccircle cx='75' cy='75' r='75' fill='%233498db'/%3E%3Cpath d='M75 40c-11 0-20 9-20 20s9 20 20 20 20-9 20-20-9-20-20-20zm0 60c-16.5 0-30 8.5-30 19v6h60v-6c0-10.5-13.5-19-30-19z' fill='%23fff'/%3E%3C/svg%3E";

const API = API_BASE_URL;

// Helper function to get full image URL
const getImageUrl = (photoUrl) => {
  if (!photoUrl) return DEFAULT_AVATAR;
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://') || photoUrl.startsWith('data:')) {
    return photoUrl;
  }
  if (photoUrl.startsWith('/uploads/')) {
    return `${API}${photoUrl}`;
  }
  return photoUrl;
};

export default function You() {
  const [tab, setTab] = useState('profile');
  const [user, setUser] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [newPhoto, setNewPhoto] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  // redirect when not logged in
  if (!authUtils.isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  // Load user data
  useEffect(() => {
    const userData = authUtils.getUser();
    setUser(userData);
    setEditValues(userData || {});
  }, []);

  // Handle field edit start
  const startEdit = (field) => {
    setEditingField(field);
    setMessage({ type: '', text: '' });
  };

  // Handle field edit cancel
  const cancelEdit = () => {
    setEditingField(null);
    setEditValues(user);
    setPhotoPreview(null);
    setNewPhoto(null);
  };

  // Handle input change
  const handleChange = (field, value) => {
    setEditValues(prev => ({ ...prev, [field]: value }));
  };

  // Handle photo selection
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setMessage({ type: 'error', text: 'Please select an image file' });
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Image size should be less than 5MB' });
        return;
      }
      
      setNewPhoto(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
      setMessage({ type: '', text: '' });
    }
  };

  // Save field changes
  const saveField = async (field) => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // If saving photo
      if (field === 'photo' && newPhoto) {
        const formData = new FormData();
        formData.append('photo', newPhoto);

        console.log('Uploading photo:', newPhoto.name, 'Size:', newPhoto.size);

        const response = await fetch(`${API}/api/user/profile`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authUtils.getToken()}`
          },
          body: formData
        });

        const data = await response.json();
        console.log('Photo upload response:', data);

        if (!response.ok) {
          throw new Error(data.message || 'Failed to update photo');
        }

        // Update user in state and localStorage
        const updatedUser = data.data;
        setUser(updatedUser);
        authUtils.setUser(updatedUser);
        setEditValues(updatedUser);
        
        setPhotoPreview(null);
        setNewPhoto(null);
        setEditingField(null);
        setMessage({ type: 'success', text: 'Profile photo updated successfully!' });

        // ✅ Dispatch custom event to update all components
        window.dispatchEvent(new CustomEvent('userUpdated', { detail: updatedUser }));
      } else {
        // Update other fields
        const updateData = {};
        updateData[field] = editValues[field];

        console.log('Updating field:', field, 'Value:', editValues[field]);

        const response = await fetch(`${API}/api/user/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authUtils.getToken()}`
          },
          body: JSON.stringify(updateData)
        });

        const data = await response.json();
        console.log('Field update response:', data);

        if (!response.ok) {
          throw new Error(data.message || 'Failed to update profile');
        }

        // Update user in state and localStorage
        const updatedUser = data.data;
        setUser(updatedUser);
        authUtils.setUser(updatedUser);
        setEditValues(updatedUser);
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        setEditingField(null);

        // ✅ Dispatch custom event to update all components
        window.dispatchEvent(new CustomEvent('userUpdated', { detail: updatedUser }));
      }
    } catch (error) {
      console.error('Update error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  // Render editable field
  const renderField = (label, field, value, type = 'text') => (
    <div className={`you-edit-field${editingField === field ? ' editing' : ''}`}>      
      <div className="flex-gap justify-between align-center">
        <div style={{ flex: 1 }}>
          <label className="you-edit-label">
            {label}
          </label>
          
          {editingField === field ? (
            <input
              type={type}
              value={editValues[field] || ''}
              onChange={(e) => handleChange(field, e.target.value)}
              className="you-edit-input"
              autoFocus
            />
          ) : (
            <div className="you-field-value">
              {type === 'password' ? '••••••••' : (value || <span className="you-field-empty">Not set</span>)}
            </div>
          )}
        </div>

        <div className="you-field-actions">
          {editingField === field ? (
            <>
              <button
                onClick={() => saveField(field)}
                className="you-btn success"
                disabled={loading}
              >
                <Save size={16} />
                {loading ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={cancelEdit}
                className="you-btn danger"
                disabled={loading}
              >
                <X size={16} />
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => startEdit(field)}
              className="you-btn primary"
            >
              <Edit2 size={16} />
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="you-loading-wrapper">
        <div className="you-loading-box">Loading your profile…</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="you-card-header">
        <h3>You (Account)</h3>
        <div className="you-tab-buttons">
          <button 
            className={tab === 'profile' ? 'btn primary' : 'btn outline'} 
            onClick={() => setTab('profile')}
          >
            Profile
          </button>
          <button 
            className={tab === 'orders' ? 'btn primary' : 'btn outline'} 
            onClick={() => setTab('orders')}
          >
            Orders
          </button>
          <button 
            className={tab === 'addresses' ? 'btn primary' : 'btn outline'} 
            onClick={() => setTab('addresses')}
          >
            Addresses
          </button>
        </div>
      </div>

      {/* Message Display */}
      {message.text && (
        <div className={`you-message ${message.type}`}>{message.text}</div>
      )}

      <div>
        {tab === 'profile' && (
          <div>
            <h4 className="you-section-title">Profile Information</h4>

            {/* Profile Photo Section */}
            <div className="you-profile-photo-section">
              <label className="you-photo-label">
                Profile Photo
              </label>

              <div className="you-profile-photo-wrapper">
                <img
                  src={photoPreview || getImageUrl(user.photoUrl)}
                  alt={user.name}
                  className="you-profile-photo"
                  onError={(e) => {
                    e.target.src = DEFAULT_AVATAR;
                  }}
                />

                {editingField === 'photo' ? (
                  <div className="you-photo-buttons">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="you-photo-input"
                    />
                    <div className="you-photo-buttons">
                      <button
                        onClick={() => saveField('photo')}
                        disabled={!newPhoto || loading}
                        className={`you-btn success${(!newPhoto || loading) ? ' disabled' : ''}`}
                      >
                        <Save size={18} />
                        {loading ? 'Uploading...' : 'Save Photo'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={loading}
                        className="you-btn danger"
                      >
                        <X size={18} />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit('photo')}
                    className="you-btn primary you-photo-change-btn"
                  >
                    <Camera size={18} />
                    Change Photo
                  </button>
                )}
              </div>
            </div>

            {/* Basic Information */}
            <h5 className="you-section-heading">Basic Information</h5>
            {renderField('Full Name', 'name', user.name)}
            {renderField('Email', 'email', user.email, 'email')}
            {renderField('Phone', 'phone', user.phone, 'tel')}
            <div className="you-account-info">
              <label className="you-edit-label">
                Role
              </label>
              <div className="you-field-value">
                <span className={`you-status-badge ${user.role === 'ADMIN' ? 'admin' : 'user'}`}>
                  {user.role}
                </span>
              </div>
            </div>

            {/* Address Information */}
            <h5 className="you-section-heading">Address Information</h5>
            {renderField('Address Line 1', 'addressLine1', user.addressLine1)}
            {renderField('Address Line 2', 'addressLine2', user.addressLine2)}
            {renderField('City', 'city', user.city)}
            {renderField('State', 'state', user.state)}
            {renderField('Postal Code', 'postalCode', user.postalCode)}
            {renderField('Country', 'country', user.country)}

            {/* Password Change */}
            <h5 className="you-section-heading">Security</h5>
            {renderField('Password', 'password', '••••••••', 'password')}

            {/* Account Info */}
            <h5 className="you-section-heading">Account Details</h5>
            <div className="you-account-info">
              <p><strong>Account Status:</strong> {user.isActive ? '✅ Active' : '❌ Inactive'}</p>
              <p><strong>Member Since:</strong> {new Date(user.createdAt).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
              <p><strong>Last Updated:</strong> {new Date(user.updatedAt).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
            </div>
          </div>
        )}

        {tab === 'orders' && (
          <div>
            <h4>Recent Orders</h4>
            <p className="text-muted mt-12 mb-16">
              View your complete order history on the Orders page.
            </p>
            <button 
              className="btn primary you-link-button"
              onClick={() => window.location.href = '/customer/orders'}
            >
              📦 View All Orders
            </button>
          </div>
        )}
        {tab === 'addresses' && (
          <div>
            <h4>Addresses</h4>
            <p className="text-muted mt-12">
              Your default shipping address is shown in the profile tab above. You can edit it there.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}