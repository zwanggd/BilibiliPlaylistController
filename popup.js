document.addEventListener('DOMContentLoaded', function() {
  const donateBtn = document.getElementById('donateBtn');
  const qrContainer = document.getElementById('qrContainer');
  
  donateBtn.addEventListener('click', () => {
    qrContainer.classList.toggle('show');
  });
});