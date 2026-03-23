export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="relative w-10 h-10">
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
          style={{
            borderTopColor: '#00c9ff',
            borderRightColor: '#7b2fdb',
            animationDuration: '0.8s',
          }}
        />
        <div
          className="absolute inset-1.5 rounded-full border-2 border-transparent animate-spin"
          style={{
            borderBottomColor: '#00c9ff',
            borderLeftColor: '#7b2fdb',
            animationDuration: '1.2s',
            animationDirection: 'reverse',
          }}
        />
      </div>
      <p className="text-sm text-on-surface-variant font-medium">{message}</p>
    </div>
  )
}
