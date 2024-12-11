export default function LoadingOverlay() {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-xl">
        <div className="text-white">Loading DCA data...</div>
      </div>
    </div>
  );
} 