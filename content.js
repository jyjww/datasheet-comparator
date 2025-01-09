document.addEventListener('click', function (e) {
    if (e.target.matches('.add-to-compare')) {
      const specData = {
        title: document.querySelector('h1').innerText,
        voltage: document.querySelector('.spec-voltage').innerText,
        current: document.querySelector('.spec-current').innerText,
        package: document.querySelector('.spec-package').innerText,
      };
  
      chrome.storage.local.get('compareList', function (data) {
        const compareList = data.compareList || [];
        compareList.push(specData);
        chrome.storage.local.set({ compareList });
        alert('제품이 추가되었습니다!');
      });
    }
  });
  