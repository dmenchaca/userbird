// Add these CSS rules inside the injectStyles function, in the style.textContent string:
```
.userbird-image-upload {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.userbird-file-input {
  display: none;
}
.userbird-image-button {
  padding: 0.5rem 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  background: white;
}
.userbird-image-button:hover {
  background: #f3f4f6;
}
.userbird-image-preview {
  display: none;
  position: relative;
}
.userbird-image-preview.show {
  display: block;
}
.userbird-image-preview img {
  width: 36px;
  height: 36px;
  object-fit: cover;
  border-radius: 6px;
}
.userbird-remove-image {
  position: absolute;
  top: -0.5rem;
  right: -0.5rem;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: #ef4444;
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  line-height: 1;
}
.userbird-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
```

// Update the modal HTML in createModal function, replace the buttons div with:
```
<div class="userbird-buttons">
  <button class="userbird-button userbird-button-secondary userbird-close">${MESSAGES.labels.cancel}</button>
  <div class="userbird-actions">
    <div class="userbird-image-upload">
      <input type="file" accept="image/jpeg,image/png" class="userbird-file-input" />
      <button class="userbird-image-button">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
      </button>
      <div class="userbird-image-preview">
        <button class="userbird-remove-image">&times;</button>
      </div>
    </div>
    <button class="userbird-button userbird-submit">
      <span class="userbird-submit-text">${MESSAGES.labels.submit}</span>
      <svg class="userbird-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
    </button>
  </div>
</div>
```

// Add these variables at the top with the other declarations:
```
let selectedImage = null;
let currentTrigger = null;
```

// Add this to the openModal function right after the debug.group line:
```
currentTrigger = trigger;

function handleClickOutside(e) {
  const modalElement = modal.modal;
  if (modalElement && !modalElement.contains(e.target) && e.target !== trigger) {
    console.log('Click detected outside widget:', {
      clickedElement: e.target,
      clickX: e.clientX,
      clickY: e.clientY
    });
    closeModal();
    document.removeEventListener('click', handleClickOutside);
  }
}

// Add click outside detection
document.addEventListener('click', handleClickOutside);

// Add ESC key handler
function handleEscKey(e) {
  if (e.key === 'Escape') {
    closeModal();
    document.removeEventListener('keydown', handleEscKey);
  }
}
document.addEventListener('keydown', handleEscKey);
```

// Add this to the setupModal function:
```
// Setup image upload
const fileInput = modal.modal.querySelector('.userbird-file-input');
const imageButton = modal.modal.querySelector('.userbird-image-button');
const imagePreview = modal.modal.querySelector('.userbird-image-preview');
const removeImageButton = modal.modal.querySelector('.userbird-remove-image');

imageButton.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  // Validate file type and size
  if (!file.type.match(/^image\/(jpeg|png)$/)) {
    modal.errorElement.textContent = MESSAGES.success.imageError;
    modal.errorElement.style.display = 'block';
    return;
  }
  
  if (file.size > 5 * 1024 * 1024) {
    modal.errorElement.textContent = MESSAGES.success.imageError;
    modal.errorElement.style.display = 'block';
    return;
  }
  
  selectedImage = file;
  const reader = new FileReader();
  
  reader.onload = (e) => {
    const img = document.createElement('img');
    img.src = e.target.result;
    imagePreview.innerHTML = '';
    imagePreview.appendChild(img);
    imagePreview.appendChild(removeImageButton);
    imagePreview.classList.add('show');
    imageButton.style.display = 'none';
  };
  
  reader.readAsDataURL(file);
});

removeImageButton.addEventListener('click', () => {
  selectedImage = null;
  imagePreview.classList.remove('show');
  imageButton.style.display = 'block';
  fileInput.value = '';
});
```

// Add this closeModal function right after the openModal function:
```
function closeModal() {
  if (!modal) return;
  currentTrigger = null;
  
  modal.modal.classList.remove('open');
  setTimeout(() => {
    modal.form.classList.remove('hidden');
    modal.successElement.classList.remove('open');
    modal.submitButton.disabled = false;
    modal.submitButton.querySelector('.userbird-submit-text').textContent = MESSAGES.labels.submit;
  }, 150);
}
```