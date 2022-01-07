import matplotlib.pyplot as plt

x = [1,10,20,30,40,50]
y = [517925,1101096,1685687,2269758,2854112,3437730]

fig, ax = plt.subplots()
ax.bar(x, y)
ax.set_xlabel("n_assets")
ax.set_ylabel("gas_used")
ax.set_ylim(ymin=0)
plt.show()
